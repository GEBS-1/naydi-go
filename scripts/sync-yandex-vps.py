"""Update only Yandex OAuth secrets; retain current application and data."""
import importlib.util,pathlib,json,datetime
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
cfg=v.config();keys=['YANDEX_CLIENT_ID','YANDEX_CLIENT_SECRET','YANDEX_AUTH_ENABLED']
assert all(cfg.get(k) for k in keys) and cfg['YANDEX_AUTH_ENABLED']=='1'
c=v.connect();ftp=c.open_sftp()
try:
 v.run(c,"""python3 - <<'PY'
import pathlib,shutil
target=pathlib.Path('/var/www/naydi-app/releases/20260929T110626Z/node_modules')
assert target.resolve()==target and target.parent.parent==pathlib.Path('/var/www/naydi-app/releases')
assert str(target.parent) not in pathlib.Path('/var/www/naydi-app/start.sh').read_text()
if target.exists():shutil.rmtree(target)
print('Removed only incomplete, inactive npm dependencies; reinstallable with npm ci')
PY""")
 path='/var/www/naydi-data/runtime.env'
 with ftp.open(path,'r') as f:old=f.read().decode()
 backup=path+'.before-yandex-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 with ftp.open(backup,'w') as f:f.write(old)
 ftp.chmod(backup,0o600)
 lines=[line for line in old.splitlines() if line.split('=',1)[0] not in keys]
 updated='\n'.join(lines+[k+'='+json.dumps(cfg[k]) for k in keys])+'\n'
 with ftp.open(path+'.yandex-pending','w') as f:f.write(updated)
 ftp.chmod(path+'.yandex-pending',0o600);ftp.posix_rename(path+'.yandex-pending',path)
 v.run(c,'pm2 restart naydigo >/dev/null')
 v.run(c,"""python3 - <<'PY'
import urllib.request,json,time
for i in range(15):
 try:
  b=json.load(urllib.request.urlopen('http://127.0.0.1:3005/api/buyer/me',timeout=5))
  assert b['providers']['yandex'];print('YANDEX_ENABLED_HEALTH_OK');break
 except Exception:time.sleep(1)
else:raise RuntimeError('Health check failed')
PY""")
 print('Updated only Yandex settings; previous runtime.env retained privately.')
finally:ftp.close();c.close()
