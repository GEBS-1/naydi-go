"""Read-only production bot and notification configuration audit. No messages sent."""
import importlib.util, pathlib, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'))
v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import pathlib,json,urllib.request,urllib.error,subprocess
cfg={}
for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
 if '=' in line:
  k,val=line.split('=',1)
  try:cfg[k]=json.loads(val)
  except:cfg[k]=val
base=cfg.get('AUTH_BASE_URL','').rstrip('/')
def get(url,headers=None):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers or {}),timeout=15) as r:return json.load(r)
 except urllib.error.HTTPError as e:return {'audit_error':'HTTPError','http_status':e.code}
 except Exception as e:return {'audit_error':type(e).__name__}
tg='https://api.telegram.org/bot'+cfg.get('TELEGRAM_BOT_TOKEN','')+'/'
me=get(tg+'getMe');info=get(tg+'getWebhookInfo').get('result',{})
pid=subprocess.run(['pm2','pid','naydigo-telegram'],capture_output=True,text=True).stdout.strip();polling=pid.isdigit() and int(pid)>0
print('telegram',json.dumps({'polling_running':polling,'api_ok':me.get('ok',False),'api_error':me.get('audit_error'),'http_status':me.get('http_status'),'username':me.get('result',{}).get('username'),'webhook_matches':info.get('url')==base+'/api/buyer/bots/telegram','pending_updates':info.get('pending_update_count'),'last_error_at':info.get('last_error_date'),'has_webhook_secret':bool(cfg.get('TELEGRAM_WEBHOOK_SECRET'))}))
api=cfg.get('MAX_API_BASE_URL') or 'https://platform-api2.max.ru'
headers={'Authorization':cfg.get('MAX_BOT_TOKEN','')}
me=get(api+'/me',headers);subs=get(api+'/subscriptions',headers)
print('max',json.dumps({'api_ok':bool(me.get('user_id') or me.get('id')),'name':me.get('name'),'api_error':me.get('audit_error'),'webhook_matches':any(s.get('url')==base+'/api/buyer/bots/max' for s in subs.get('subscriptions',[])),'subscription_error':subs.get('audit_error'),'enabled':cfg.get('MAX_AUTH_ENABLED')=='1','has_webhook_secret':bool(cfg.get('MAX_WEBHOOK_SECRET'))}))
print('notifications',json.dumps({'telegram_owner_configured':bool(cfg.get('OWNER_TELEGRAM_CHAT_ID')),'max_owner_configured':bool(cfg.get('OWNER_MAX_USER_ID'))}))
print('release',str(pathlib.Path('/var/www/naydi-app/current').resolve()))
PY""")
finally:c.close()
