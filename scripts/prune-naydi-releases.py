"""Server-side NaydiGo retention: keep only the verified running release.

Only immutable old release directories and unused legacy application code are
removed. Databases, uploads, backups, environment files and other apps are excluded.
"""
import argparse,json,os,pathlib,re,shlex,shutil,subprocess,urllib.request

ROOT=pathlib.Path('/var/www/naydi-app')
LEGACY=['node_modules','.next','.vinext','dist','app','lib','public','scripts','db','drizzle','build']

def process_paths():
 paths=[]
 for proc in pathlib.Path('/proc').iterdir():
  if not proc.name.isdigit():continue
  for name in ['cwd','exe']:
   try:paths.append(str((proc/name).resolve(strict=True)))
   except (OSError,RuntimeError):pass
  # A process can load code from a release while using a different working directory.
  try:
   paths.extend((proc/'cmdline').read_bytes().decode(errors='replace').split('\0'))
   paths.extend(line.split()[-1] for line in (proc/'maps').read_text().splitlines() if '/' in line)
  except (OSError,IndexError):pass
 return paths

def process_list():
 raw=subprocess.check_output(['pm2','jlist'],text=True,timeout=15)
 for i,char in enumerate(raw):
  if char=='[':
   try:
    value,_=json.JSONDecoder().raw_decode(raw[i:])
    if isinstance(value,list) and all(isinstance(p,dict) for p in value):return value
   except ValueError:pass
 raise RuntimeError('Cannot verify PM2 process list')

def running_release(expected=None):
 assert ROOT.resolve()==ROOT and not ROOT.is_symlink(),'Unexpected application root'
 releases=ROOT/'releases';assert releases.is_dir() and not releases.is_symlink()
 link=ROOT/'current';assert link.is_symlink(),'Missing current release link'
 current=link.resolve(strict=True)
 assert current.parent==releases and re.fullmatch(r'\d{8}T\d{6}Z',current.name),'Unexpected current path'
 if expected:assert current.name==expected,'Running release changed; cleanup cancelled'
 assert (current/'dist/server/index.js').is_file(),'Running build is incomplete'
 start=(ROOT/'start.sh').read_text()
 starts=[shlex.split(line)[1] for line in start.splitlines() if line.startswith('cd ')]
 assert len(starts)==1 and pathlib.Path(starts[0]).resolve()==current,'start.sh and current disagree'
 apps=[p for p in process_list() if p.get('name')=='naydigo']
 assert len(apps)==1 and apps[0]['pm2_env'].get('status')=='online','NaydiGo is not online'
 cwd=(pathlib.Path('/proc')/str(apps[0]['pid'])/'cwd').resolve(strict=True)
 assert cwd==current,'Running process does not use current release'
 with urllib.request.urlopen('http://127.0.0.1:3005/api/catalog',timeout=15) as r:
  body=json.load(r);assert r.status==200 and isinstance(body.get('stores'),list) and isinstance(body.get('products'),list),'Health check failed'
 return current

def in_use(target,paths):
 prefix=str(target)
 return any(p==prefix or p.startswith(prefix+'/') for p in paths)

def protected_symlinks(target):
 # Do not remove legacy dependencies shared by another app through a symlink.
 for sibling in ROOT.parent.iterdir():
  if sibling==ROOT or not sibling.is_dir():continue
  candidate=sibling/'node_modules'
  if candidate.is_symlink():
   resolved=candidate.resolve()
   if resolved==target or target in resolved.parents:return True
 return False

def configured_legacy():
 protected=set()
 nginx=subprocess.run(['nginx','-T'],capture_output=True,text=True,timeout=15)
 assert nginx.returncode==0,'Cannot verify static-file configuration'
 for line in nginx.stdout.splitlines():
  match=re.match(r'^\s*(?:root|alias)\s+([^;]+);',line)
  if not match:continue
  values=shlex.split(match[1])
  if not values or not values[0].startswith('/'):continue
  path=pathlib.Path(values[0]).resolve()
  for name in LEGACY:
   candidate=ROOT/name
   if path==ROOT or path==candidate or candidate in path.parents:protected.add(name)
 # Scheduled maintenance may still use legacy scripts even when it is idle.
 files=[pathlib.Path('/etc/crontab')]
 for directory in ['/etc/cron.d','/var/spool/cron/crontabs']:
  if pathlib.Path(directory).is_dir():files.extend(p for p in pathlib.Path(directory).iterdir() if p.is_file())
 for file in files:
  if not file.is_file():continue
  for line in file.read_text(errors='replace').splitlines():
   if line.lstrip().startswith('#'):continue
   if re.search(r'\bcd\s+[\"\x27]?'+re.escape(str(ROOT))+r'[\"\x27]?(?:\s|$)',line):protected.update(LEGACY)
   for name in LEGACY:
    if str(ROOT/name) in line:protected.update([name,'node_modules'])
 return protected

def plan(current):
 targets=[];paths=process_paths();configured=configured_legacy()
 for p in sorted((ROOT/'releases').iterdir()):
  if p==current:continue
  assert re.fullmatch(r'\d{8}T\d{6}Z',p.name) and p.is_dir() and not p.is_symlink(),'Unexpected release entry'
  assert p.resolve().parent==ROOT/'releases' and p.name<current.name,'Potential concurrent/newer deployment; cleanup cancelled'
  assert not in_use(p,paths),'An old release still has a running process; cleanup cancelled'
  targets.append(p)
 for name in LEGACY:
  p=ROOT/name
  if not p.exists():continue
  assert p.is_dir() and not p.is_symlink() and p.resolve().parent==ROOT,'Unexpected legacy path'
  if name in configured or in_use(p,paths) or protected_symlinks(p):continue
  # A release may deliberately share a legacy path. Keep it in that case.
  local=current/name
  if local.is_symlink() and (local.resolve()==p or p in local.resolve().parents):continue
  targets.append(p)
 return targets

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--expect-release');args=parser.parse_args()
 assert os.name=='posix' and pathlib.Path('/proc').exists(),'Run on the VPS only'
 if args.apply:assert args.expect_release and re.fullmatch(r'\d{8}T\d{6}Z',args.expect_release),'Explicit current release required'
 current=running_release(args.expect_release);targets=plan(current)
 before=shutil.disk_usage(ROOT).free
 result={'current':str(current),'policy':'keep only running healthy release','apply':args.apply,'targets':[],'freeBeforeBytes':before}
 for p in targets:
  size=int(subprocess.check_output(['du','-sx','-B1',str(p)],text=True,timeout=60).split()[0])
  result['targets'].append({'path':str(p),'bytes':size})
 if args.apply:
  # Validate once more before any deletion and retain the running path throughout.
  assert running_release(args.expect_release)==current
  assert plan(current)==targets,'Filesystem or process inventory changed'
  for p in targets:
   assert (ROOT/'current').resolve()==current and p!=current
   assert p.resolve()==p and (p.parent==ROOT/'releases' or p.parent==ROOT and p.name in LEGACY)
   assert not in_use(p,process_paths()),'Process started using an old path; cleanup stopped'
   shutil.rmtree(p)
  assert running_release(args.expect_release)==current
 result['freeAfterBytes']=shutil.disk_usage(ROOT).free
 result['freedBytes']=result['freeAfterBytes']-before
 result['remainingReleases']=sorted(p.name for p in (ROOT/'releases').iterdir())
 result['retainedLegacyPaths']=[str(ROOT/name) for name in LEGACY if (ROOT/name).exists() and ROOT/name not in targets]
 if args.apply:assert result['remainingReleases']==[current.name]
 print(json.dumps(result,indent=2))

if __name__=='__main__':main()
