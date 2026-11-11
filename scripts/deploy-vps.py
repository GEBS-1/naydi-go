"""Deploy only NaydiGo, preserving data and all other VPS applications."""
from pathlib import Path
import importlib.util, datetime, tarfile, json, shlex, sys, re, os, secrets
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
sys.stderr.reconfigure(encoding='utf-8',errors='replace')

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('vps',ROOT/'scripts/vps-naydi.py');vps=importlib.util.module_from_spec(spec);spec.loader.exec_module(vps)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
args=sys.argv[1:]
stage='--stage' in args;prepared='--prepared' in args
prune_old_dependencies='--prune-old-dependencies' in args
resume=[a for a in args if a not in ['--stage','--prepared','--prune-old-dependencies']]
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
 if prune_old_dependencies:
  print('Release retention is automatic after successful deployment.',flush=True)
 run("python3 -c \"import shutil,os; s=shutil.disk_usage('/var/www/naydi-app'); assert s.free>2*1024**3, 'Need at least 2 GiB free before deployment'; assert os.statvfs('/var/www/naydi-app').f_favail>150000, 'Need free inodes'\"")
 run("test -d /var/www/naydi-app && test -f /var/www/naydi-data/runtime.env && mkdir -p "+release+' '+backup)
 sftp.chmod(backup,0o700)
 if not resume:
  remote_archive=release+'/source.tar.gz';sftp.put(str(archive),remote_archive)
  run('cd '+release+' && tar -xzf source.tar.gz && npm ci --no-audit --no-fund',900)
 run('cd '+release+" && node --input-type=module -e 'import {Jimp} from \"jimp\"; import {imageSize} from \"image-size\"; const photo=await new Jimp({width:2,height:2,color:0xffffffff}).getBuffer(\"image/jpeg\"); if(imageSize(photo).width!==2)process.exit(1); console.log(\"PHOTO_REVIEW_RUNTIME_OK\")'")
 if prepared:
  if not resume:raise RuntimeError('--prepared requires --resume')
  run('test -f '+release+'/.naydi-build-ready && test -f '+release+'/dist/server/index.js')
 else:
  run('cd '+release+' && npm run build',900)
  put(release+'/.naydi-build-ready',stamp+'\n')
 if stage:
  (local/'report.json').write_text(json.dumps({'release':release,'status':'staged'},indent=2))
  print('STAGED',release,flush=True)
  raise SystemExit(0)
 # Do not copy local identity mocks, SSH credentials or any local database.
 values=vps.config();allowed=['NAYDI_LEGAL_STATUS','NAYDI_LEGAL_NAME','NAYDI_LEGAL_INN','NAYDI_LEGAL_OGRN','NAYDI_LEGAL_ADDRESS','NAYDI_LEGAL_EMAIL','NAYDI_LEGAL_PHONE','ADMIN_BUYER_ID','YANDEX_CLIENT_ID','YANDEX_CLIENT_SECRET','YANDEX_AUTH_ENABLED','BUYER_AUTH_ENABLED','BUYER_QUOTA_ENABLED','AUTH_BASE_URL','EMAIL_AUTH_ENABLED','EMAIL_FROM','EMAIL_REPLY_TO','RESEND_API_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_BOT_USERNAME','TELEGRAM_WEBHOOK_SECRET','OWNER_TELEGRAM_CHAT_ID','MAX_BOT_TOKEN','MAX_BOT_URL','MAX_WEBHOOK_SECRET','OWNER_MAX_USER_ID','MAX_AUTH_ENABLED','MAX_API_BASE_URL','YOOKASSA_ENABLED','YOOKASSA_SHOP_ID','YOOKASSA_SECRET_KEY','YOOKASSA_TEST_MODE','ROUTERAI_API_KEY','ROUTERAI_MODEL','ROUTERAI_WEB_MODEL','ROUTERAI_WEB_MODE','API_MAX_CALL_RUB','OVERPASS_URL','PHOTON_URL','VALHALLA_URL']
 runtime={}
 try:
  with sftp.open('/var/www/naydi-data/runtime.env') as f:
   for line in f.read().decode().splitlines():
    if '=' in line and not line.startswith('#'):k,val=line.split('=',1);runtime[k]=val.strip().strip('"')
 except FileNotFoundError:pass
 for k in allowed:
  if values.get(k) and not runtime.get(k):runtime[k]=values[k]
 for provider in ['TELEGRAM','MAX']:
  if runtime.get(provider+'_BOT_TOKEN'):runtime.setdefault(provider+'_WEBHOOK_SECRET',secrets.token_hex(32))
 if not runtime.get('DATABASE_URL'):raise RuntimeError('PostgreSQL must be provisioned and the production SQLite migrated before deploying this release; running app unchanged')
 if os.environ.get('NAYDI_ADMIN_PASSWORD'):runtime['NAYDI_ADMIN_PASSWORD']=os.environ['NAYDI_ADMIN_PASSWORD']
 runtime.pop('NAYDI_DB',None)
 runtime.update({'AUTH_BASE_URL':'https://naydigo.prepromo.ru','BUYER_AUTH_ENABLED':'1','MAX_AUTH_ENABLED':'1','YANDEX_AUTH_ENABLED':'0','EMAIL_AUTH_ENABLED':'0','BUYER_QUOTA_ENABLED':'0','YOOKASSA_ENABLED':'0','NODE_ENV':'production','AUTH_TRUSTED_PROXY':'0','NAYDI_BUCKET':'/var/www/naydi-data/bucket','VINEXT_TRUSTED_HOSTS':'naydigo.prepromo.ru','VINEXT_TRUST_PROXY':'1'})
 if not runtime.get('ROUTERAI_API_KEY'):raise RuntimeError('RouterAI key missing; no switch')
 new_start='#!/bin/bash\nset -e\ncd '+release+'\nexport NODE_ENV=production\nexport VINEXT_TRUSTED_HOSTS=naydigo.prepromo.ru\nexport VINEXT_TRUST_PROXY=1\nexec node ./scripts/start-node.mjs --port 3005 --hostname 127.0.0.1\n'
 # Deployment is PostgreSQL-only. Live migration is a separate, locally accepted step.
 # Snapshot PostgreSQL and photos before schema changes; never touch another app.
 run('cd '+release+' && NAYDI_BACKUP_DIR='+backup+' node scripts/backup-postgres.mjs')
 run('python3 '+release+'/scripts/verify-postgres-backup.py '+backup)
 run('cp /var/www/naydi-app/start.sh '+backup+'/start.sh && cp /var/www/naydi-data/runtime.env '+backup+'/runtime.env')
 run('pm2 stop naydigo >/dev/null')
 try:
  put('/var/www/naydi-data/runtime.env','\n'.join(k+'='+json.dumps(v,ensure_ascii=False) for k,v in runtime.items())+'\n')
  run('cd '+release+' && node scripts/postgres-migrate.mjs')
  put('/var/www/naydi-app/start.sh',new_start,0o755)
  run('pm2 restart naydigo >/dev/null')
  run("python3 - <<'PY'\nimport urllib.request,time,json\nfor i in range(30):\n try:\n  b=json.load(urllib.request.urlopen('http://127.0.0.1:3005/api/catalog',timeout=5));assert isinstance(b.get('stores'),list) and isinstance(b.get('products'),list);print('LOCAL_HEALTH_OK',len(b['stores']),'stores',len(b['products']),'products');break\n except Exception:\n  time.sleep(2)\nelse:raise RuntimeError('Health check failed')\nPY")
  run('ln -sfn '+release+' /var/www/naydi-app/current.next && mv -Tf /var/www/naydi-app/current.next /var/www/naydi-app/current')
 except Exception:
  run('cp '+backup+'/start.sh /var/www/naydi-app/start.sh && cp '+backup+'/runtime.env /var/www/naydi-data/runtime.env && pm2 restart naydigo >/dev/null')
  raise
 # Nginx config is deliberately unchanged. Validate it; no reload required.
 run('nginx -t')
 run("curl --fail --silent --show-error -o /dev/null -w 'HTTPS:%{http_code}\\n' https://naydigo.prepromo.ru/")
 report={'release':release,'backup':backup,'status':'deployed','nginx':'unchanged','retention':'pending'}
 (local/'report.json').write_text(json.dumps(report,indent=2))
 # Keep the old version through startup/HTTPS validation, then retain only the live release.
 run('mkdir -p /var/www/naydi-app/maintenance')
 put('/var/www/naydi-app/maintenance/telegram-poll.py',(ROOT/'scripts/telegram-poll.py').read_text(encoding='utf-8'))
 run('if pm2 describe naydigo-telegram >/dev/null 2>&1; then pm2 restart naydigo-telegram >/dev/null; fi')
 put('/var/www/naydi-app/maintenance/prune-releases.py',(ROOT/'scripts/prune-naydi-releases.py').read_text(encoding='utf-8'))
 put('/var/www/naydi-app/maintenance/retention.json',json.dumps({'keepWorkingReleases':1,'cleanupAfter':'successful startup and HTTPS check','preserve':['database','uploads','data backups']},indent=2))
 run('python3 /var/www/naydi-app/maintenance/prune-releases.py --expect-release '+stamp+' --apply')
 report['retention']='only-current-working-release'
 (local/'report.json').write_text(json.dumps(report,indent=2))
 print('DEPLOYED',release,'BACKUP',backup,flush=True)
finally:sftp.close();client.close()
