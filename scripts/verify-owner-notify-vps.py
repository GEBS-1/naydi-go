"""Verify the deployed NaydiGo owner notification without printing secrets."""
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('vps', ROOT / 'scripts/vps-naydi.py')
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

client = vps.connect()
try:
    vps.run(client, r"""python3 - <<'PY'
import json,pathlib,urllib.request
env={}
for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
 if '=' not in line or line.lstrip().startswith('#'):continue
 key,value=line.split('=',1)
 try:env[key]=json.loads(value)
 except json.JSONDecodeError:env[key]=value.strip().strip('"')
token=env.get('TELEGRAM_BOT_TOKEN');chat=env.get('OWNER_TELEGRAM_CHAT_ID')
assert token and chat,'Telegram owner notification is not configured'
payload=json.dumps({'chat_id':chat,'text':'НайдиGo: личные уведомления о новых заявках подключены и проверены.','disable_web_page_preview':True}).encode()
request=urllib.request.Request('https://api.telegram.org/bot'+token+'/sendMessage',data=payload,headers={'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(request,timeout=15) as response:
 result=json.load(response)
assert result.get('ok') is True
start=pathlib.Path('/var/www/naydi-app/start.sh').read_text()
assert '/var/www/naydi-app/releases/20261001T193843Z' in start
print('OWNER_TELEGRAM_DELIVERY_OK ACTIVE_RELEASE_20261001T193843Z')
PY""")
finally:
    client.close()
