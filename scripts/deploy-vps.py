"""Deploy only NaydiGo, preserving data and all other VPS applications."""
from pathlib import Path
import importlib.util, datetime, tarfile, json, shlex, sys, re, os, secrets
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
sys.stderr.reconfigure(encoding='utf-8',errors='replace')

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('vps',ROOT/'scripts/vps-naydi.py');vps=importlib.util.module_from_spec(spec);spec.loader.exec_module(vps)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
resume=sys.argv[1:]
if resume:
 if len(resume)!=2 or resume[0]!='--resume' or not re.fullmatch(r'\d{8}T\d{6}Z',resume[1]):raise SystemExit('Usage: deploy-vps.py [--resume YYYYMMDDTHHMMSSZ]')
 stamp=resume[1]
release='/var/www/naydi-app/releases/'+stamp
backup='/var/www/naydi-data/backups/'+stamp
if resume:backup+='-resume-'+datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
local=ROOT/'artifacts'/('deploy-'+stamp);local.mkdir(parents=True,exist_ok=True)
archive=local/'source.tar.gz'
skip={'.git','node_modules','.wrangler','dist','out','.next','.vinext','artifacts','.sites-runtime','.agents','.codex','outputs','work','__pycache__'}
if not resume:
 with tarfile.open(archive,'w:gz') as tar:
  for directory,dirs,files in os.walk(ROOT):
   dirs[:]=[d for d in dirs if d not in skip and not (Path(directory)/d).is_symlink()]
   for name in files:
    p=Path(directory)/name
    if p.is_symlink() or (name.startswith('.env') and name!='.env.example') or name in ['.dev.vars','tsconfig.tsbuildinfo']:continue
    tar.add(p,arcname=str(p.relative_to(ROOT)),recursive=False)

client=vps.connect();sftp=client.open_sftp()
def run(command,timeout=900):
 _,out,err=client.exec_command(command,timeout=timeout)
 output=out.read().decode(errors='replace');errors=err.read().decode(errors='replace')
 for k,v in vps.config().items():
  if v and any(s in k for s in ['PASSWORD','SECRET','TOKEN','API_KEY']):output=output.replace(v,'[REDACTED]');errors=errors.replace(v,'[REDACTED]')
 print(output,flush=True);print(errors,flush=True)
 if out.channel.recv_exit_status():raise RuntimeError('Scoped deployment step failed')
def put(path,content,mode=0o600):
 with sftp.open(path,'w') as f:f.write(content)
 sftp.chmod(path,mode)
try:
 run("python3 -c \"import shutil,os; s=shutil.disk_usage('/var/www/naydi-app'); assert s.free>3*1024**3, 'Need at least 3 GiB free before deployment'; assert os.statvfs('/var/www/naydi-app').f_favail>150000, 'Need free inodes'\"")
 run("test -d /var/www/naydi-app && test -f /var/www/naydi-data/naydi.sqlite && mkdir -p "+release+' '+backup)
 sftp.chmod(backup,0o700)
 if not resume:
  remote_archive=release+'/source.tar.gz';sftp.put(str(archive),remote_archive)
  run('cd '+release+' && tar -xzf source.tar.gz && npm ci --no-audit --no-fund',900)
 run('cd '+release+' && npm run build',900)
 # Do not copy local identity mocks, SSH credentials or any local database.
 values=vps.config();allowed=['ADMIN_BUYER_ID','YANDEX_CLIENT_ID','YANDEX_CLIENT_SECRET','YANDEX_AUTH_ENABLED','BUYER_AUTH_ENABLED','BUYER_QUOTA_ENABLED','AUTH_BASE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_BOT_USERNAME','TELEGRAM_WEBHOOK_SECRET','OWNER_TELEGRAM_CHAT_ID','MAX_BOT_TOKEN','MAX_BOT_URL','MAX_WEBHOOK_SECRET','OWNER_MAX_USER_ID','MAX_AUTH_ENABLED','MAX_API_BASE_URL','YOOKASSA_ENABLED','YOOKASSA_SHOP_ID','YOOKASSA_SECRET_KEY','YOOKASSA_TEST_MODE','ROUTERAI_API_KEY','ROUTERAI_MODEL','ROUTERAI_WEB_MODEL','ROUTERAI_WEB_MODE','API_MONTHLY_LIMIT_RUB','API_MAX_CALL_RUB','API_UNCERTAIN_LIMIT_RUB','OVERPASS_URL','PHOTON_URL','VALHALLA_URL']
 runtime={}
 try:
  with sftp.open('/var/www/naydi-data/runtime.env') as f:
   for line in f.read().decode().splitlines():
    if '=' in line and not line.startswith('#'):k,val=line.split('=',1);runtime[k]=val.strip().strip('"')
 except FileNotFoundError:pass
 for k in allowed:
  if values.get(k):runtime[k]=values[k]
 for provider in ['TELEGRAM','MAX']:
  if runtime.get(provider+'_BOT_TOKEN'):runtime.setdefault(provider+'_WEBHOOK_SECRET',secrets.token_hex(32))
 runtime.update({'NODE_ENV':'production','AUTH_TRUSTED_PROXY':'0','NAYDI_DB':'/var/www/naydi-data/naydi.sqlite','NAYDI_BUCKET':'/var/www/naydi-data/bucket','VINEXT_TRUSTED_HOSTS':'naydigo.prepromo.ru','VINEXT_TRUST_PROXY':'1'})
 if not runtime.get('ROUTERAI_API_KEY'):raise RuntimeError('RouterAI key missing; no switch')
 new_start='#!/bin/bash\nset -e\ncd '+release+'\nexport NODE_ENV=production\nexport VINEXT_TRUSTED_HOSTS=naydigo.prepromo.ru\nexport VINEXT_TRUST_PROXY=1\nexec node --import ./scripts/naydi-node-env.mjs ./node_modules/vinext/dist/cli.js start --port 3005 --hostname 127.0.0.1\n'
 # Backup and restore rehearsal happen with only this process stopped, immediately before migration.
 run('pm2 stop naydigo >/dev/null')
 try:
  run("python3 - <<'PY'\n"+f"backup={backup!r}\nrelease={release!r}\n"+r'''
import pathlib,sqlite3,shutil,hashlib,json
b=pathlib.Path(backup);d=pathlib.Path('/var/www/naydi-data');a=pathlib.Path('/var/www/naydi-app')
assert a.resolve()==a and d.resolve()==d
shutil.copy2(a/'start.sh',b/'start.sh')
if (d/'runtime.env').exists():shutil.copy2(d/'runtime.env',b/'runtime.env')
db=sqlite3.connect(d/'naydi.sqlite');copy=sqlite3.connect(b/'naydi.sqlite');db.backup(copy);copy.close()
shutil.copytree(d/'bucket',b/'bucket')
protected=['shops','products','onboarding','preview_tokens','owner_invites','uploads']
def fingerprint(con):
 stable={'shops':'id,owner,data,visibility','products':'id,store_id,published,data'}
 return {t:hashlib.sha256(json.dumps(con.execute('SELECT '+stable.get(t,'*')+' FROM '+t+' ORDER BY 1').fetchall(),ensure_ascii=False).encode()).hexdigest() for t in protected}
before=fingerprint(db)
test=sqlite3.connect(b/'restore-check.sqlite');saved=sqlite3.connect(b/'naydi.sqlite');saved.backup(test)
assert test.execute('PRAGMA integrity_check').fetchone()[0]=='ok' and fingerprint(test)==before
test.close();saved.close()
tables={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
expected=[('0002_redundant_smiling_tiger.sql',{'connection_requests','discovery_limits','discovery_sources','shopping_plans'}),('0003_minor_spot.sql',{'external_places','search_cache','search_locks','search_metrics'}),('0004_acoustic_stepford_cuckoos.sql',{'api_budget','api_calls'}),('0005_empty_killraven.sql',{'owner_accounts','owner_sessions'}),('0006_buyer_access.sql',{'buyer_accounts','buyer_sessions','buyer_logins','buyer_grants','buyer_searches','buyer_payments'}),('0007_bot_news.sql',{'bot_news_consent','bot_news_deliveries'}),('0008_buyer_personal.sql',{'buyer_personal','payment_audit'}),('0009_product_events.sql',{'product_events'})]
sql=[]
for file,needed in expected:
 present=needed&tables
 if present and present!=needed:raise RuntimeError('Partial schema: '+file)
 if not present:sql.append((pathlib.Path(release)/'drizzle'/file).read_text())
product_columns={r[1] for r in db.execute('PRAGMA table_info(products)')}
ingestion_columns={'normalized_name','source_type','source_url','checked_at'}
if product_columns&ingestion_columns and not ingestion_columns<=product_columns:raise RuntimeError('Partial schema: 0010_product_ingestion.sql')
if not product_columns&ingestion_columns:sql.append((pathlib.Path(release)/'drizzle'/'0010_product_ingestion.sql').read_text())
db.executescript('BEGIN IMMEDIATE;\n'+'\n'.join(sql)+'\nCOMMIT;')
assert fingerprint(db)==before and db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
photos=lambda root:{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
assert photos(d/'bucket')==photos(b/'bucket')
(b/'verified.json').write_text(json.dumps({'protected_hashes':before,'photo_files':len(photos(d/'bucket')),'integrity':'ok','restore':'ok','migrations':len(sql)}))
print('BACKUP_RESTORE_MIGRATIONS_OK',len(sql),'protected tables unchanged')
db.close()
'''+'\nPY')
  put('/var/www/naydi-data/runtime.env','\n'.join(k+'='+json.dumps(v,ensure_ascii=False) for k,v in runtime.items())+'\n')
  put('/var/www/naydi-app/start.sh',new_start,0o755)
  run('ln -sfn '+release+' /var/www/naydi-app/current.next && mv -Tf /var/www/naydi-app/current.next /var/www/naydi-app/current')
  run('pm2 restart naydigo >/dev/null')
  run("python3 - <<'PY'\nimport urllib.request,time,json\nfor i in range(30):\n try:\n  b=json.load(urllib.request.urlopen('http://127.0.0.1:3005/api/catalog',timeout=5));assert b.get('stores')==[] and b.get('products')==[];print('LOCAL_HEALTH_OK_PRIVATE_CATALOG');break\n except Exception:\n  time.sleep(2)\nelse:raise RuntimeError('Health check failed')\nPY")
 except Exception:
  run('cp '+backup+'/start.sh /var/www/naydi-app/start.sh && pm2 restart naydigo >/dev/null')
  raise
 # Nginx config is deliberately unchanged. Validate it; no reload required.
 run('nginx -t')
 run("curl --fail --silent --show-error -o /dev/null -w 'HTTPS:%{http_code}\\n' https://naydigo.prepromo.ru/")
 (local/'report.json').write_text(json.dumps({'release':release,'backup':backup,'status':'deployed','nginx':'unchanged'},indent=2))
 print('DEPLOYED',release,'BACKUP',backup,flush=True)
finally:sftp.close();client.close()
