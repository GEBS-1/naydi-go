"""Read-only inventory of currently stored public seller-catalog search cache."""
import collections
import importlib.util
import json
import pathlib
import re
import sys
import urllib.parse

spec = importlib.util.spec_from_file_location('vps', pathlib.Path(__file__).with_name('vps-naydi.py'))
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

client = vps.connect()
try:
    command = """python3 - <<'PY'
import collections,json,re,sqlite3,time,urllib.parse
d=sqlite3.connect('file:/var/www/naydi-data/naydi.sqlite?mode=ro',uri=True)
rows=d.execute("SELECT id,data,expires_at FROM search_cache WHERE id LIKE 'seller-catalog:v8:%'").fetchall()
items=[]
for cache_id,raw,expires_at in rows:
 try:
  values=json.loads(raw)
  if isinstance(values,list):
   for x in values:
    if isinstance(x,dict) and x.get('kind')=='product':
     host=urllib.parse.urlparse(x.get('site') or x.get('source') or '').hostname or 'unknown'
     items.append((host,x,int(expires_at)))
 except Exception:pass
now=int(time.time()*1000)
hosts=collections.defaultdict(list)
for host,item,expiry in items:hosts[host].append((item,expiry))
result={'asOf':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sources':{}}
for host,values in sorted(hosts.items()):
 products=[item for item,_ in values]
 result['sources'][host]={'products':len(products),'priced':sum(x.get('price') is not None for x in products),'images':sum(bool(x.get('image')) for x in products),'confirmedPoints':sum(bool(x.get('point') and x.get('address') and x.get('locationEvidence')=='confirmed-point') for x in products),'stale':all(expiry<=now for _,expiry in values),'samples':[{'title':x.get('title'),'price':x.get('price'),'address':x.get('address'),'point':x.get('point'),'availability':x.get('sourceAvailability'),'checkedAt':x.get('checkedAt'),'url':x.get('site') or x.get('source')} for x in products[:2]]}
queries={
 'дрели':r'дрел|шуруповерт|шуруповёрт',
 'наушники':r'наушник|гарнитур',
 'велосипеды':r'велосипед',
 'корм кошкам':r'корм.*кош|корм.*кот|кош.*корм|кот.*корм',
 'корм собакам':r'корм.*собак|корм.*пес|корм.*щен|собак.*корм|пес.*корм|щен.*корм',
 'лампы':r'ламп|светодиод',
 'аккумуляторы авто':r'аккумулятор.*авто|авто.*аккумулятор|стартерн',
 'букеты':r'букет|цветочн|цветы|розы|тюльпан|хризантем|пион|альстромер|гербер|лилия|гвоздик',
}
result['queries']={}
for name,pattern in queries.items():
 found=[(host,x,expiry) for host,x,expiry in items if re.search(pattern,(str(x.get('title',''))+' '+str(x.get('description',''))+' '+str(x.get('category',''))).lower()) and not (name=='букеты' and re.search(r'семен|сажен|рассад|луковиц',str(x.get('title','')).lower()))]
 result['queries'][name]={'products':len(found),'priced':sum(x.get('price') is not None for _,x,_ in found),'confirmedPoints':sum(bool(x.get('point') and x.get('address') and x.get('locationEvidence')=='confirmed-point') for _,x,_ in found),'samples':[{'seller':x.get('seller'),'title':x.get('title'),'price':x.get('price'),'availability':x.get('sourceAvailability'),'checkedAt':x.get('checkedAt'),'source':x.get('site') or x.get('source')} for _,x,_ in found[:3]]}
shops=[]
for raw, in d.execute("SELECT data FROM shops WHERE visibility='public'").fetchall():
 try:
  x=json.loads(raw)
  if x.get('demo') or x.get('testOnly'):continue
  site=x.get('site') or ''
  shops.append({'name':x.get('name'),'city':x.get('city'),'address':x.get('street') or x.get('address'),'siteHost':urllib.parse.urlparse(site).hostname,'confirmedPoint':bool(x.get('addressConfirmed') and (x.get('street') or x.get('address')) and isinstance(x.get('lat'),(int,float)) and isinstance(x.get('lng'),(int,float)))})
 except Exception:pass
result['publicStores']=shops
result['publicStoreCount']=len(shops)
result['publicStoresWithConfirmedPoint']=sum(s['confirmedPoint'] for s in shops)
print(json.dumps(result,ensure_ascii=True))
d.close()
PY"""
    _, stdout, stderr = client.exec_command(command, timeout=120)
    output = stdout.read().decode('utf-8')
    if stdout.channel.recv_exit_status():
        raise RuntimeError('Read-only inventory query failed.')
    report = json.loads(output)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
finally:
    client.close()
