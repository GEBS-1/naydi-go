"""Run on NaydiGo VPS. Preview by default; --send explicitly authorizes delivery."""
import argparse, hashlib, json, pathlib, sqlite3, time, urllib.request

def main():
 p=argparse.ArgumentParser();p.add_argument('--text-file',required=True);p.add_argument('--send',action='store_true');a=p.parse_args()
 text=pathlib.Path(a.text_file).read_text(encoding='utf-8').strip()
 if not 1<=len(text)<=3000:raise SystemExit('Message must contain 1–3000 characters')
 text+='\n\nОтключить сообщения: /stop'
 campaign=hashlib.sha256(text.encode()).hexdigest()
 db=sqlite3.connect('/var/www/naydi-data/naydi.sqlite',timeout=15)
 users=db.execute('SELECT provider,subject FROM bot_news_consent WHERE subscribed=1').fetchall()
 print('Message:',text);print('Consenting recipients:',len(users),'Send:',a.send)
 if not a.send:return
 cfg={}
 for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
  if '=' in line:
   k,v=line.split('=',1)
   try:cfg[k]=json.loads(v)
   except ValueError:cfg[k]=v
 sent=0;uncertain=0;skipped=0
 for provider,subject in users:
  now=int(time.time()*1000);db.execute('BEGIN IMMEDIATE')
  allowed=db.execute('SELECT 1 FROM bot_news_consent WHERE provider=? AND subject=? AND subscribed=1',(provider,subject)).fetchone()
  recent=db.execute('SELECT 1 FROM bot_news_deliveries WHERE provider=? AND subject=? AND (campaign=? OR created_at>?)',(provider,subject,campaign,now-86400000)).fetchone()
  if not allowed or recent:db.rollback();skipped+=1;continue
  db.execute('INSERT INTO bot_news_deliveries VALUES(?,?,?,?,?)',(campaign,provider,subject,'reserved',now));db.commit()
  # Reserve before network. A crash/timeout is never retried automatically (avoid duplicates).
  try:
   headers={'Content-Type':'application/json'}
   if provider=='telegram':
    url='https://api.telegram.org/bot'+cfg['TELEGRAM_BOT_TOKEN']+'/sendMessage';body={'chat_id':subject,'text':text}
   else:
    base=cfg.get('MAX_API_BASE_URL','https://platform-api2.max.ru')
    if base not in ['https://platform-api.max.ru','https://platform-api2.max.ru']:raise ValueError('Invalid provider')
    url=base+'/messages?user_id='+str(int(subject));headers['Authorization']=cfg['MAX_BOT_TOKEN'];body={'text':text}
   with urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(body).encode(),headers=headers),timeout=15) as r:result=json.load(r)
   if result.get('ok') is False or result.get('success') is False:raise ValueError('Provider rejected message')
   status='sent';sent+=1
  except Exception:
   status='unknown';uncertain+=1 # Never print errors containing API URLs/tokens.
  db.execute('UPDATE bot_news_deliveries SET status=? WHERE campaign=? AND provider=? AND subject=?',(status,campaign,provider,subject));db.commit();time.sleep(0.5)
 print('Sent:',sent,'Unknown/failed:',uncertain,'Skipped:',skipped)
if __name__=='__main__':main()
