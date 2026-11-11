"""Read-only production chat checks. Never creates users, threads or messages."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import urllib.request,urllib.error,json,pathlib
base='https://naydigo.prepromo.ru'
def call(path,body=None):
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Origin':base,'Content-Type':'application/json','User-Agent':'NaydiGO-Deployment'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read().decode()
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
for path in ['/','/sell','/messages']:
 status,text=call(path);assert status==200,(path,status)
 if path=='/messages':assert 'Сообщения' in text and 'Тест: покупатель' not in text and 'Локальная проверка с двух сторон' not in text
 print('LIVE_PAGE',path,status,flush=True)
status,_=call('/api/messages');assert status==401
status,_=call('/api/messages',{'action':'start','productId':'11111111-1111-4111-8111-111111111111'});assert status==401
status,_=call('/api/dev/chat-demo?as=buyer',{});assert status==404
status,text=call('/api/connect?seller=1');assert status==200;providers=json.loads(text)['providers'];assert providers['telegram'] and providers['max']
print('CHAT_AUTH_ENABLED_AND_PRIVATE',flush=True)
print('TELEGRAM_MAX_ENABLED',json.dumps(providers),flush=True)
print('RELEASE',str(pathlib.Path('/var/www/naydi-app/current').resolve()),flush=True)
PY""")
 v.run(c,"""cd /var/www/naydi-app/current && node --input-type=module - <<'JS'
import {Pool} from 'pg';import {postgresSettings} from './scripts/postgres-migrate.mjs';
const p=new Pool({connectionString:postgresSettings().DATABASE_URL,max:1});try{const r=await p.query("SELECT to_regclass('chat_threads') IS NOT NULL AS threads,to_regclass('chat_messages') IS NOT NULL AS messages,(SELECT COUNT(*) FROM naydi_migrations WHERE name='0004_worthless_cerise.sql') AS migration");if(!r.rows[0].threads||!r.rows[0].messages||Number(r.rows[0].migration)!==1)throw Error('Chat schema missing');console.log('CHAT_POSTGRES_READY',JSON.stringify(r.rows[0]));}finally{await p.end()}
JS""")
finally:c.close()
