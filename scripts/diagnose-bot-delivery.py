"""Read-only bot transport diagnostics, no messages or user data."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import json,pathlib,subprocess,socket
cfg={}
for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
 if '=' in line:
  k,val=line.split('=',1)
  try:cfg[k]=json.loads(val)
  except:cfg[k]=val
base='https://api.telegram.org/bot'+cfg['TELEGRAM_BOT_TOKEN']+'/'
for family in ['-4','-6']:
 for method in ['getMe','getWebhookInfo']:
  p=subprocess.run(['curl',family,'--silent','--connect-timeout','3','--max-time','5','--retry','2','--retry-all-errors',base+method],capture_output=True,text=True)
  try:
   b=json.loads(p.stdout);r=b.get('result',{});print(family,method,json.dumps({'ok':b.get('ok'),'pending':r.get('pending_update_count'),'last_error':r.get('last_error_message'),'last_error_at':r.get('last_error_date'),'webhook_ip':r.get('ip_address')}))
  except:print(family,method,'transport_exit',p.returncode)
print('telegram_dns',sorted(set(x[4][0] for x in socket.getaddrinfo('api.telegram.org',443))))
print('site_dns',sorted(set(x[4][0] for x in socket.getaddrinfo('naydigo.prepromo.ru',443))))
p=subprocess.run(['curl','-4','--silent','--connect-timeout','3','--max-time','5','-o','/dev/null','-w','%{http_code}','-X','POST','https://naydigo.prepromo.ru/api/buyer/bots/telegram'],capture_output=True,text=True)
print('public_webhook_without_secret',p.stdout,'curl_exit',p.returncode)
PY""")
finally:c.close()
