"""NaydiGO Telegram incoming transport. No tokens or message contents in logs.

Only use after disabling this bot's webhook. Handler and login logic remain in
the application. Persist offset only after successful handling, never discard
pending updates on deployment.
"""
import json,os,pathlib,time,urllib.request,urllib.error,urllib.parse,http.client

DATA=pathlib.Path('/var/www/naydi-data')
def config():
 result={}
 for line in (DATA/'runtime.env').read_text().splitlines():
  if '=' in line and not line.startswith('#'):
   k,val=line.split('=',1)
   try:result[k]=json.loads(val)
   except ValueError:result[k]=val
 return result

def request(url,body,headers=None,timeout=40):
 if url.endswith('/getUpdates'):
  query={k:json.dumps(v) if isinstance(v,list) else v for k,v in body.items()}
  parsed=urllib.parse.urlsplit(url)
  connection=http.client.HTTPSConnection(parsed.hostname,timeout=3)
  try:
   connection.request('GET',parsed.path+'?'+urllib.parse.urlencode(query))
   if connection.sock:connection.sock.settimeout(timeout)
   response=connection.getresponse()
   if response.status!=200:raise RuntimeError('Polling HTTP '+str(response.status))
   return json.loads(response.read())
  finally:connection.close()
 else:req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={'Content-Type':'application/json',**(headers or {})})
 with urllib.request.urlopen(req,timeout=timeout) as response:return json.load(response)

def run():
 cfg=config();token=cfg['TELEGRAM_BOT_TOKEN'];secret=cfg['TELEGRAM_WEBHOOK_SECRET']
 state=DATA/'telegram-update-offset.json'
 try:offset=int(json.loads(state.read_text())['offset'])
 except FileNotFoundError:offset=0
 failures=0
 print('Telegram polling ready',flush=True)
 while True:
  try:
   result=request('https://api.telegram.org/bot'+token+'/getUpdates',{'offset':offset,'timeout':25,'limit':20,'allowed_updates':['message','callback_query']})
   if not result.get('ok'):raise RuntimeError('Polling API failure')
   for event in result['result']:
    update_id=event['update_id']
    if not isinstance(update_id,int):raise RuntimeError('Invalid update ID')
    try:request('http://127.0.0.1:3005/api/buyer/bots/telegram',event,{'X-Telegram-Bot-Api-Secret-Token':secret},timeout=30)
    except urllib.error.HTTPError as e:
     if e.code not in [400,413]:raise
     print('Unsupported update skipped',e.code,flush=True)
    offset=update_id+1
    temporary=state.with_suffix('.tmp');temporary.write_text(json.dumps({'offset':offset}));os.chmod(temporary,0o600);temporary.replace(state)
    print('Telegram update handled',flush=True)
   failures=0
  except Exception as e:
   failures+=1
   print('Telegram transport retry',type(e).__name__,getattr(e,'code',''),flush=True)
   time.sleep(min(5,2**min(failures,3)))

if __name__=='__main__':run()
