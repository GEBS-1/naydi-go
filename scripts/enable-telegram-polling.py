"""Switch only the configured NaydiGO Telegram bot to server polling."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import json,pathlib,urllib.request,subprocess,time
cfg={}
for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
 if '=' in line:
  k,val=line.split('=',1)
  try:cfg[k]=json.loads(val)
  except:cfg[k]=val
base='https://api.telegram.org/bot'+cfg['TELEGRAM_BOT_TOKEN']+'/'
def call(method,body):
 for attempt in range(3):
  try:
   req=urllib.request.Request(base+method,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
   with urllib.request.urlopen(req,timeout=8) as r:b=json.load(r)
   assert b.get('ok'),'Bot API rejected configuration'
   return b['result']
  except Exception:
   if attempt==2:raise RuntimeError('Telegram configuration API unavailable') from None
   time.sleep(1)
me=call('getMe',{});assert me['username'].lower()==cfg['TELEGRAM_BOT_USERNAME'].lstrip('@').lower()
info=call('getWebhookInfo',{});assert not info.get('url') or info['url']==cfg['AUTH_BASE_URL'].rstrip('/')+'/api/buyer/bots/telegram','Foreign webhook, unchanged'
script='/var/www/naydi-app/maintenance/telegram-poll.py';assert pathlib.Path(script).is_file()
call('setMyCommands',{'commands':[{'command':'start','description':'Приветствие и основные действия'},{'command':'help','description':'Как войти и разместить товар'},{'command':'subscribe','description':'Подписаться на новости'},{'command':'stop','description':'Отключить рассылку'},{'command':'id','description':'Мой ID для настройки уведомлений'}]})
call('deleteWebhook',{'drop_pending_updates':False})
existing=subprocess.run(['pm2','describe','naydigo-telegram'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
if existing:subprocess.run(['pm2','restart','naydigo-telegram'],check=True,stdout=subprocess.DEVNULL)
else:subprocess.run(['pm2','start',script,'--name','naydigo-telegram','--interpreter','python3','--cwd','/var/www/naydi-app/maintenance','--time'],check=True,stdout=subprocess.DEVNULL)
subprocess.run(['pm2','save'],check=True,stdout=subprocess.DEVNULL)
print('TELEGRAM_POLLING_ENABLED pending events preserved; command menu configured')
PY""")
finally:c.close()
