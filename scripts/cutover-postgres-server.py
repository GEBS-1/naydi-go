"""Run on the VPS inside a staged release; migrate only NaydiGo, retaining SQLite rollback."""
from pathlib import Path
import os,sys,json,secrets,subprocess,sqlite3,shutil,hashlib,time,urllib.request

release=Path(__file__).resolve().parent.parent
assert release.parent==Path('/var/www/naydi-app/releases') and (release/'.naydi-build-ready').exists()
data=Path('/var/www/naydi-data');app=Path('/var/www/naydi-app')
assert data.resolve()==data and app.resolve()==app
stamp=release.name;backup=data/'backups'/(stamp+'-sqlite-cutover')
backup.mkdir(mode=0o700,parents=True,exist_ok=True)
runtime=data/'runtime.env'
def read_config(path):
 result={}
 for line in path.read_text().splitlines():
  if '=' in line and not line.startswith('#'):
   key,value=line.split('=',1)
   try:result[key]=json.loads(value)
   except:result[key]=value.strip('"')
 return result
cfg=read_config(runtime)
if cfg.get('DATABASE_URL'):raise RuntimeError('Already configured for PostgreSQL; use normal deployment instead')
def call(args,**kwargs):
 result=subprocess.run(args,text=True,capture_output=True,check=False,**kwargs)
 if result.returncode:
  message=result.stderr[-1500:]
  for key,value in cfg.items():
   if value and any(s in key for s in ['TOKEN','SECRET','PASSWORD','DATABASE_URL']):message=message.replace(str(value),'[REDACTED]')
  raise RuntimeError(str(args[0])+' failed: '+message)
 return result.stdout
def psql(sql):return call(['runuser','-u','postgres','--','psql','-X','-tA','-v','ON_ERROR_STOP=1','-d','postgres'],input=sql).strip()
assert psql('SHOW fsync;')=='on' and psql('SHOW synchronous_commit;')=='on'
assert psql('SHOW listen_addresses;') in ['localhost','127.0.0.1']
credentials=data/'postgres-bootstrap.json'
if credentials.exists():db=json.loads(credentials.read_text())
else:
 if psql("SELECT 1 FROM pg_roles WHERE rolname='naydigo_app';") or psql("SELECT 1 FROM pg_database WHERE datname='naydigo';"):raise RuntimeError('Unexpected existing database/role; refusing to reuse')
 db={'password':secrets.token_hex(32)};credentials.write_text(json.dumps(db));credentials.chmod(0o600)
if not psql("SELECT 1 FROM pg_roles WHERE rolname='naydigo_app';"):
 psql("CREATE ROLE naydigo_app LOGIN PASSWORD '"+db['password']+"' NOSUPERUSER NOCREATEDB NOCREATEROLE;")
if not psql("SELECT 1 FROM pg_database WHERE datname='naydigo';"):psql('CREATE DATABASE naydigo OWNER naydigo_app;')
url='postgresql://naydigo_app:'+db['password']+'@127.0.0.1:5432/naydigo'
old_start=(app/'start.sh').read_text();old_runtime=runtime.read_text();old_release=(app/'current').resolve()
assert old_release.parent==app/'releases' and not (app/'current.next').exists()
(backup/'start.sh').write_text(old_start);(backup/'runtime.env').write_text(old_runtime);(backup/'runtime.env').chmod(0o600)
protected=['shops','products','onboarding','uploads','buyer_accounts','buyer_sessions','connection_requests']
def fingerprints(con):
 return {t:hashlib.sha256(json.dumps(con.execute('SELECT * FROM '+t+' ORDER BY rowid').fetchall(),ensure_ascii=False).encode()).hexdigest() for t in protected}
stopped=False
try:
 call(['pm2','stop','naydigo']);stopped=True
 source=sqlite3.connect(data/'naydi.sqlite');snapshot=sqlite3.connect(backup/'naydi.sqlite')
 source.backup(snapshot);assert snapshot.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 before=fingerprints(source);assert fingerprints(snapshot)==before;source.close()
 shutil.copytree(data/'bucket',backup/'bucket',dirs_exist_ok=True)
 tables={r[0] for r in snapshot.execute("SELECT name FROM sqlite_master WHERE type='table'")}
 columns={r[1] for r in snapshot.execute('PRAGMA table_info(products)')}
 needed={'normalized_name','source_type','source_url','checked_at'}
 if columns&needed and not needed<=columns:raise RuntimeError('Partial products migration')
 sql=[]
 if not columns&needed:sql.append((release/'drizzle/0010_product_ingestion.sql').read_text())
 if 'buyer_identities' not in tables:sql.append((release/'drizzle/0013_messenger_identities.sql').read_text())
 sql.append((release/'drizzle/0012_single_seller_shop.sql').read_text())
 snapshot.executescript('BEGIN IMMEDIATE;\n'+'\n'.join(sql)+'\nCOMMIT;')
 assert fingerprints(snapshot)==before;snapshot.close()
 print('CONSISTENT_SQLITE_BACKUP_OK',flush=True)
 env={**os.environ,'DATABASE_URL':url,'NAYDI_SQLITE_SOURCE':str(backup/'naydi.sqlite')}
 output=call(['node','scripts/migrate-postgres.mjs'],cwd=release,env=env)
 (backup/'migration-report.json').write_text(output)
 print('POSTGRES_DATA_MIGRATED_AND_VERIFIED',flush=True)
 cfg.pop('NAYDI_DB',None)
 cfg.update({'DATABASE_URL':url,'NODE_ENV':'production','AUTH_BASE_URL':'https://naydigo.prepromo.ru','AUTH_TRUSTED_PROXY':'0','BUYER_AUTH_ENABLED':'1','MAX_AUTH_ENABLED':'1','YANDEX_AUTH_ENABLED':'0','EMAIL_AUTH_ENABLED':'0','BUYER_QUOTA_ENABLED':'0','YOOKASSA_ENABLED':'0','NAYDI_BUCKET':str(data/'bucket')})
 assert all(cfg.get(k) for k in ['TELEGRAM_BOT_TOKEN','TELEGRAM_BOT_USERNAME','TELEGRAM_WEBHOOK_SECRET','MAX_BOT_TOKEN','MAX_BOT_URL','MAX_WEBHOOK_SECRET'])
 runtime.write_text('\n'.join(k+'='+json.dumps(v,ensure_ascii=False) for k,v in cfg.items())+'\n');runtime.chmod(0o600)
 (app/'start.sh').write_text('#!/bin/bash\nset -e\ncd '+str(release)+'\nexport NODE_ENV=production\nexport VINEXT_TRUSTED_HOSTS=naydigo.prepromo.ru\nexport VINEXT_TRUST_PROXY=1\nexec node ./scripts/start-node.mjs --port 3005 --hostname 127.0.0.1\n');(app/'start.sh').chmod(0o755)
 call(['pm2','restart','naydigo'])
 for attempt in range(30):
  try:
   def get(path):
    with urllib.request.urlopen('http://127.0.0.1:3005'+path,timeout=5) as r:return json.load(r)
   seller=get('/api/connect?seller=1');catalog=get('/api/catalog')
   assert seller['providers']=={'telegram':True,'max':True} and isinstance(catalog['stores'],list)
   break
  except Exception:time.sleep(2)
 else:raise RuntimeError('New application health check failed')
 link=app/'current.next';link.symlink_to(release);link.replace(app/'current')
 call(['node','scripts/backup-postgres.mjs'],cwd=release,env={**os.environ,'NAYDI_BACKUP_DIR':str(backup/'postgres')})
 report={'release':str(release),'backup':str(backup),'postgres':True,'providers':seller['providers'],'protected_hashes':before,'status':'deployed'}
 (backup/'cutover-report.json').write_text(json.dumps(report,indent=2))
 print(json.dumps({k:v for k,v in report.items() if k!='protected_hashes'}),flush=True)
except Exception:
 if stopped:
  runtime.write_text(old_runtime);(app/'start.sh').write_text(old_start)
  call(['pm2','restart','naydigo'])
  if (app/'current').resolve()!=old_release:
   link=app/'rollback.next';link.symlink_to(old_release);link.replace(app/'current')
  print('ROLLED_BACK_TO_PREVIOUS_APPLICATION; PostgreSQL and backups retained',flush=True)
 raise
