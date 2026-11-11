"""Read-only disk inventory scoped to NaydiGo deployment artifacts."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import pathlib,shutil,subprocess,json
r=pathlib.Path('/var/www/naydi-app')
print('disk',json.dumps(shutil.disk_usage(r)._asdict()))
print('current',str((r/'current').resolve()))
print('start_release',next((line[3:] for line in (r/'start.sh').read_text().splitlines() if line.startswith('cd ')),''))
for p in sorted(r.iterdir()):
 if p.is_dir() and not p.is_symlink():
  print('app_directory',p.name,subprocess.check_output(['du','-sm',str(p)],text=True).split()[0])
releases=r/'releases'
if releases.exists():
 for p in sorted(releases.iterdir()):
  if p.is_dir() and not p.is_symlink():
   print('release',p.name,subprocess.check_output(['du','-sm',str(p)],text=True).split()[0],json.dumps({name:(p/name).exists() for name in ['node_modules','dist','.next','.vinext','source.tar.gz']}))
PY""")
finally:c.close()
