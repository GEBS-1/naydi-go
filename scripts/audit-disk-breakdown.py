"""Read-only VPS disk inventory: sizes and filesystem metadata, no file contents."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import pathlib,subprocess,json,shutil,os,datetime
print('TIME',datetime.datetime.now(datetime.timezone.utc).isoformat(),flush=True)
print('DISK',json.dumps(shutil.disk_usage('/')._asdict()),flush=True)
def sizes(label,path,depth=1):
 if not pathlib.Path(path).exists():return
 r=subprocess.run(['du','-x','-B1','--max-depth='+str(depth),path],capture_output=True,text=True,timeout=80)
 rows=[]
 for line in r.stdout.splitlines():
  try:
   amount,name=line.split('\t',1);rows.append({'bytes':int(amount),'path':name})
  except ValueError:pass
 print(label,json.dumps(sorted(rows,key=lambda x:x['bytes'],reverse=True)[:35]),flush=True)
 if r.returncode:print(label+'_PARTIAL',r.returncode,flush=True)
sizes('ROOT','/')
sizes('VAR','/var')
sizes('WWW','/var/www')
sizes('ROOT_HOME','/root')
sizes('HOME','/home')
sizes('LOGS','/var/log')
sizes('VAR_LIB','/var/lib')
sizes('CACHE','/var/cache')
sizes('NAYDI_APP','/var/www/naydi-app')
sizes('NAYDI_RELEASES','/var/www/naydi-app/releases')
sizes('NAYDI_DATA','/var/www/naydi-data')
sizes('NAYDI_BACKUPS','/var/www/naydi-data/backups')
sizes('PM2','/root/.pm2')
sizes('NPM','/root/.npm')
print('CURRENT_RELEASE',str(pathlib.Path('/var/www/naydi-app/current').resolve()),flush=True)
r=subprocess.run(['journalctl','--disk-usage'],capture_output=True,text=True,timeout=10);print('JOURNAL',r.stdout.strip(),flush=True)
r=subprocess.run(['df','-B1','/'],capture_output=True,text=True,timeout=10);print('DF',r.stdout.strip(),flush=True)
try:
 r=subprocess.run(['lsof','-nP','+L1'],capture_output=True,text=True,timeout=15)
 entries=[]
 for line in r.stdout.splitlines()[1:]:
  p=line.split()
  if len(p)>8 and p[6].isdigit():entries.append({'process':p[0],'pid':p[1],'bytes':int(p[6]),'path':' '.join(p[9:])})
 print('OPEN_DELETED',json.dumps(sorted(entries,key=lambda x:x['bytes'],reverse=True)[:15]),flush=True)
except FileNotFoundError:print('OPEN_DELETED','lsof unavailable',flush=True)
PY""")
finally:c.close()
