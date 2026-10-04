"""Restore only NaydiGo's runtime adapter; preserve data and billing records."""
import importlib.util,sys,json,datetime
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
spec=importlib.util.spec_from_file_location('vps',Path(__file__).with_name('vps-naydi.py'))
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
c=v.connect();s=c.open_sftp()
root='/var/www/naydi-app';data='/var/www/naydi-data'
backup=data+'/backups/router-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
try:
 v.run(c,'mkdir -m 700 '+backup+' && cp '+root+'/scripts/naydi-node-env.mjs '+backup+'/adapter.mjs && cp '+root+'/start.sh '+backup+'/start.sh')
 with s.open(data+'/runtime.env') as f:runtime=f.read().decode()
 if 'ROUTERAI_API_KEY=' not in runtime:raise RuntimeError('Missing saved server RouterAI configuration')
 s.put(str(Path(__file__).with_name('naydi-node-env.mjs')),root+'/scripts/naydi-node-env.mjs')
 with s.open(root+'/start.sh') as f:start=f.read().decode()
 if 'export VINEXT_TRUST_PROXY=1' not in start:start=start.replace('cd /var/www/naydi-app','cd /var/www/naydi-app\nexport VINEXT_TRUST_PROXY=1\nexport VINEXT_TRUSTED_HOSTS=naydigo.prepromo.ru')
 with s.open(root+'/start.sh','w') as f:f.write(start)
 s.chmod(root+'/start.sh',0o755)
 v.run(c,'pm2 restart naydigo >/dev/null')
 v.run(c,"python3 - <<'PY'\nimport urllib.request,json,time\nfor i in range(15):\n try:\n  b=json.load(urllib.request.urlopen('http://127.0.0.1:3005/api/discovery',timeout=5))\n  assert b['ai'] and b['external'];print(json.dumps(b));break\n except Exception:time.sleep(1)\nelse:raise RuntimeError('RouterAI runtime check failed')\nPY")
 print('RESTORED; backup:',backup)
finally:s.close();c.close()
