"""Configure only explicitly provided NaydiGo bots. Refuse foreign webhook targets."""
import importlib.util, pathlib, sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
spec=importlib.util.spec_from_file_location('vps',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import pathlib,json,urllib.request,urllib.error
cfg={}
for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
 if '=' in line:
  k,val=line.split('=',1)
  try:cfg[k]=json.loads(val)
  except:cfg[k]=val
base=cfg['AUTH_BASE_URL'].rstrip('/')
assert base=='https://naydigo.prepromo.ru'
def call(url,headers=None,body=None):
 req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**(headers or {})})
 try:
  with urllib.request.urlopen(req,timeout=20) as response:return json.load(response)
 except Exception as e:raise RuntimeError('Bot API request failed: '+type(e).__name__) from None
tg='https://api.telegram.org/bot'+cfg['TELEGRAM_BOT_TOKEN']+'/'
me=call(tg+'getMe')['result'];assert me['username'].lower()==cfg['TELEGRAM_BOT_USERNAME'].lstrip('@').lower(),'Telegram bot identity mismatch'
info=call(tg+'getWebhookInfo')['result'];target=base+'/api/buyer/bots/telegram'
assert not info.get('url') or info['url']==target,'Existing Telegram webhook belongs to another application; unchanged'
r=call(tg+'setWebhook',body={'url':target,'secret_token':cfg['TELEGRAM_WEBHOOK_SECRET'],'allowed_updates':['message','callback_query'],'drop_pending_updates':False})
assert r.get('ok');print('TELEGRAM_WEBHOOK_OK')
assert call(tg+'setMyCommands',body={'commands':[{'command':'start','description':'Вход в НайдиGo и переход на сайт'},{'command':'id','description':'Показать мой ID для уведомлений'},{'command':'subscribe','description':'Согласиться на новости и предложения (до 1 в день)'},{'command':'stop','description':'Отключить рассылку'}]}).get('ok')
api=cfg.get('MAX_API_BASE_URL','https://platform-api2.max.ru');headers={'Authorization':cfg['MAX_BOT_TOKEN']};target=base+'/api/buyer/bots/max'
me=call(api+'/me',headers);assert cfg['MAX_BOT_URL'].rstrip('/').endswith('/'+me['username']),'MAX bot identity mismatch'
info=call(api+'/subscriptions',headers)
assert all(s.get('url')==target for s in info.get('subscriptions',[])),'Existing MAX webhook belongs to another application; unchanged'
r=call(api+'/subscriptions',headers,{'url':target,'secret':cfg['MAX_WEBHOOK_SECRET'],'update_types':['bot_started','message_created','message_callback']})
assert r.get('success');print('MAX_WEBHOOK_OK')
PY""")
finally:c.close()
