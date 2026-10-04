"""Scoped NaydiGo SSH maintenance. Never prints credentials or preview URLs."""
from pathlib import Path
import json, os, sys
import paramiko

ROOT = Path(__file__).resolve().parent.parent
def config():
    result = {}
    for name in ('.env', '.env.local', '.env.yookassa.test', '.env.buyer'):
        path = ROOT / name
        if path.exists():
            for line in path.read_text(encoding='utf-8-sig').splitlines():
                if '=' in line and not line.lstrip().startswith('#'):
                    key, value = line.split('=', 1)
                    result[key.strip()] = value.strip().strip('"').strip("'")
    return result

def connect():
    c = config()
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(c['DEPLOY_HOST'], port=int(c.get('DEPLOY_PORT', '22')), username=c['DEPLOY_USER'], password=c.get('DEPLOY_SSH_PASSWORD'), timeout=20, auth_timeout=20, banner_timeout=20)
    return client

def run(client, command):
    _, stdout, stderr = client.exec_command(command, timeout=120)
    output, errors = stdout.read().decode(), stderr.read().decode()
    # Defense in depth: redact configured secrets if any command unexpectedly emits them.
    for k, v in config().items():
        if v and any(s in k for s in ('PASSWORD', 'SECRET', 'TOKEN', 'API_KEY')):
            output, errors = output.replace(v, '[REDACTED]'), errors.replace(v, '[REDACTED]')
    print(output, end=''); print(errors, end='', file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    if code: raise RuntimeError('Remote command exit '+str(code))

if __name__ == '__main__':
    client = connect()
    try:
        if sys.argv[1:] == ['counts']:
            run(client, """python3 - <<'PY'
import json,sqlite3
d=sqlite3.connect('file:/var/www/naydi-data/naydi.sqlite?mode=ro',uri=True)
result={
 'shops_total':d.execute('SELECT COUNT(*) FROM shops').fetchone()[0],
 'shops_public':d.execute("SELECT COUNT(*) FROM shops WHERE visibility='public' AND COALESCE(json_extract(data,'$.demo'),0)=0").fetchone()[0],
 'shops_draft':d.execute("SELECT COUNT(*) FROM shops WHERE visibility='draft'").fetchone()[0],
 'products_total':d.execute('SELECT COUNT(*) FROM products').fetchone()[0],
 'products_public':d.execute("SELECT COUNT(*) FROM products p JOIN shops s ON s.id=p.store_id WHERE p.published=1 AND s.visibility='public' AND COALESCE(json_extract(p.data,'$.demo'),0)=0 AND COALESCE(json_extract(p.data,'$.testOnly'),0)=0 AND COALESCE(json_extract(s.data,'$.demo'),0)=0").fetchone()[0],
 'cached_catalog_products':d.execute("SELECT COALESCE(SUM(json_array_length(data)),0) FROM search_cache WHERE id LIKE 'seller-catalog:v8:%'").fetchone()[0]
}
print(json.dumps(result))
d.close()
PY""")
            raise SystemExit(0)
        if sys.argv[1:] == ['inspect']:
            run(client, """python3 - <<'PY'
import pathlib,json,sqlite3
r=pathlib.Path('/var/www/naydi-app'); d=pathlib.Path('/var/www/naydi-data')
for name in ['start.sh','scripts/sites-env.mjs','scripts/run-framework.mjs','db/index.ts','dist/server/wrangler.json']:
 p=r/name
 if p.exists():
  if name.endswith('wrangler.json'):
   v=json.loads(p.read_text());print(name,json.dumps({k:v.get(k) for k in ['main','assets','d1_databases','r2_buckets','compatibility_flags']})); print('VAR_NAMES',list(v.get('vars',{})))
  else: print('FILE',name,'\\n',p.read_text())
p=r/'.dev.vars'
if p.exists():print('DEV_VAR_NAMES',[s.split('=',1)[0] for s in p.read_text().splitlines() if '=' in s and not s.lstrip().startswith('#')])
for p in d.rglob('*.sqlite'):
 con=sqlite3.connect('file:'+str(p)+'?mode=ro',uri=True);tables=[x[0] for x in con.execute("SELECT name FROM sqlite_master WHERE type='table'")];print('DB',str(p),'TABLES',tables)
 if 'shops' in tables:
  print('COUNTS',con.execute('SELECT COUNT(*) FROM shops').fetchone()[0],con.execute('SELECT COUNT(*) FROM products').fetchone()[0]);print('VISIBILITY',con.execute('SELECT visibility,COUNT(*) FROM shops GROUP BY visibility').fetchall())
 con.close()
print('STATE_LINK',str((r/'.wrangler/state').resolve()))
PY""")
            raise SystemExit(0)
        if sys.argv[1:] != ['audit']: raise SystemExit('Supported: audit, inspect, counts')
        run(client, """python3 - <<'PY'
import json, pathlib, subprocess
root=pathlib.Path('/var/www/naydi-app'); data=pathlib.Path('/var/www/naydi-data')
print('APP_REALPATH',root.resolve()); print('DATA_REALPATH',data.resolve())
for p in [root/'package.json',root/'ecosystem.config.cjs',root/'ecosystem.config.js']:
 if p.exists():
  if p.name=='package.json': print('PACKAGE',json.dumps(json.loads(p.read_text()).get('scripts',{})))
  else: print('PROCESS_CONFIG_EXISTS',p.name)
raw=subprocess.check_output(['pm2','jlist']).decode(); processes=None
for i,c in enumerate(raw):
 if c=='[':
  try:
   value,_=json.JSONDecoder().raw_decode(raw[i:])
   if isinstance(value,list) and all(isinstance(p,dict) for p in value): processes=value; break
  except ValueError: pass
if processes is None: raise RuntimeError('PM2 did not return a process list')
for p in processes:
 if p.get('name')=='naydigo':
  e=p['pm2_env']; print('PROCESS',json.dumps({k:e.get(k) for k in ['name','pm_cwd','pm_exec_path','exec_interpreter','status']}))
print('APP_FILES',json.dumps([str(p.relative_to(root)) for p in root.glob('*') if p.name not in ['node_modules','.git','.env','.env.local']]))
print('DATA_FILES',json.dumps([p.name for p in data.glob('*')]))
for p in [root/'.env',root/'.env.local',data/'.env',data/'.env.local']:
 if p.exists(): print('ENV_KEYS',str(p),[s.split('=',1)[0] for s in p.read_text().splitlines() if '=' in s and not s.lstrip().startswith('#')])
nginx=pathlib.Path('/etc/nginx/sites-available/naydi-prepromo')
if nginx.exists():
 print('NGINX_SITE', '\\n'.join(l for l in nginx.read_text().splitlines() if l.strip().startswith(('server_name','listen','proxy_pass'))))
print('NODE',subprocess.check_output(['node','--version']).decode().strip())
PY""")
    finally: client.close()
