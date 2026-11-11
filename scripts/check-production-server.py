"""Post-deploy HTTPS/API smoke check from VPS; no bot messages or listings created."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import urllib.request,urllib.error,json,pathlib,shutil
base='https://naydigo.prepromo.ru'
def get(path,body=None):
 request=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Origin':base,'Content-Type':'application/json','User-Agent':'NaydiGO-Deploy-QA'})
 try:
  with urllib.request.urlopen(request,timeout=110) as r:return r.status,r.url,r.read().decode()
 except urllib.error.HTTPError as e:return e.code,e.url,e.read().decode()
for path in ['/','/sell','/connect','/business-demo']:
 status,url,text=get(path);assert status==200
 if path!='/':assert 'Войдите и разместите товар' in text and url.endswith('/sell')
 print('PAGE_OK',path,status,flush=True)
status,_,text=get('/api/connect?seller=1');providers=json.loads(text)['providers'];assert status==200 and providers['telegram'] and providers['max'];print('PROVIDERS',json.dumps(providers),flush=True)
status,_,_=get('/api/dev/seller-session',{});assert status==404
status,_,_=get('/api/listings/draft');assert status==401
print('PRODUCTION_AUTH_GUARDS_OK',flush=True)
status,_,text=get('/api/search?qa=1',{'query':'набор гаечных ключей','city':'Казань','near':{'lat':55.7963,'lng':49.1088}})
b=json.loads(text);assert status==200 and b['phase']=='complete';hits=b.get('hits',[])
print('LIVE_SEARCH',json.dumps({'http':status,'phase':b['phase'],'results':len(hits),'mappable':sum(bool(h.get('point') and h.get('address') and h.get('locationEvidence')=='confirmed-point') for h in hits),'withPhotos':sum(bool(h.get('image')) for h in hits),'sources':b.get('sources'),'warnings':b.get('warnings')},ensure_ascii=False),flush=True)
assert hits,'Live search returned no results'
print('RELEASE',str(pathlib.Path('/var/www/naydi-app/current').resolve()),flush=True)
print('FREE_BYTES',shutil.disk_usage('/var/www/naydi-app').free,flush=True)
PY""")
finally:c.close()
