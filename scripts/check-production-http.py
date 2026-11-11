"""Live public HTTP checks through Windows curl. No users or listings created."""
import json,pathlib,subprocess,datetime
base='https://naydigo.prepromo.ru'
out=pathlib.Path('artifacts/production-unified');out.mkdir(parents=True,exist_ok=True)
def call(path,body=None):
 args=['curl.exe','--silent','--show-error','--location','--retry','2','--retry-delay','1','--connect-timeout','15','--max-time','120','--write-out','\n%{http_code} %{url_effective}']
 if body is not None:
  payload=out/'request.json';payload.write_text(json.dumps(body,ensure_ascii=False),encoding='utf-8')
  args+=['--request','POST','--header','Origin: '+base,'--header','Content-Type: application/json','--data-binary','@'+str(payload)]
 r=subprocess.run(args+[base+path],capture_output=True,check=True)
 text,meta=r.stdout.decode('utf-8').rsplit('\n',1);status,url=meta.split(' ',1)
 return int(status),url,text
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'transport':'direct external HTTPS via curl','pages':{}}
for path in ['/','/sell','/connect','/business-demo']:
 status,url,text=call(path);assert status==200,(path,status)
 if path!='/':assert 'Войдите и разместите товар' in text and url.endswith('/sell'),path
 report['pages'][path]={'http':status,'finalUrl':url}
status,_,text=call('/api/connect?seller=1');b=json.loads(text);assert status==200 and b['providers']['telegram'] and b['providers']['max'];report['providers']=b['providers']
status,_,_=call('/api/dev/seller-session',{});assert status==404
status,_,_=call('/api/listings/draft');assert status==401
report['demoDisabled']=True;report['anonymousDraftProtected']=True
status,_,text=call('/api/search?qa=1',{'query':'набор гаечных ключей','city':'Казань','near':{'lat':55.7963,'lng':49.1088}});b=json.loads(text);assert status==200 and b['phase']=='complete'
hits=b.get('hits',[]);report['search']={'http':status,'phase':b['phase'],'results':len(hits),'mappable':sum(bool(h.get('point') and h.get('address') and h.get('locationEvidence')=='confirmed-point') for h in hits),'withPhotos':sum(bool(h.get('image')) for h in hits),'sources':b.get('sources'),'warnings':b.get('warnings')};assert hits,'Live search returned no results'
(out/'http-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
