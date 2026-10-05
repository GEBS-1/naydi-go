import importlib.util, pathlib

spec = importlib.util.spec_from_file_location('vps', pathlib.Path(__file__).with_name('vps-naydi.py'))
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

client = vps.connect()
try:
    vps.run(client, """python3 - <<'PY'
import collections,json,sqlite3,time,urllib.parse
d=sqlite3.connect('file:/var/www/naydi-data/naydi.sqlite?mode=ro',uri=True)
rows=d.execute("SELECT id,data,expires_at FROM search_cache WHERE id LIKE 'seller-catalog:v8:%'").fetchall()
items=[]
for cache_id,raw,expires_at in rows:
 try:
  values=json.loads(raw)
  if isinstance(values,list):items.extend(x for x in values if isinstance(x,dict))
 except Exception:pass
products=[x for x in items if x.get('kind')=='product']
urls={x.get('site') or x.get('source') for x in products if x.get('site') or x.get('source')}
hosts=collections.Counter()
for x in products:
 try:hosts[urllib.parse.urlparse(x.get('site') or x.get('source') or '').hostname or 'unknown']+=1
 except Exception:hosts['unknown']+=1
result={
 'cache_sources':len(rows),
 'cache_sources_expired':sum(1 for _,_,expiry in rows if expiry<=int(time.time()*1000)),
 'entries':len(items),
 'product_entries':len(products),
 'unique_product_urls':len(urls),
 'with_price':sum(x.get('price') is not None for x in products),
 'with_image':sum(bool(x.get('image')) for x in products),
 'with_seller':sum(bool(x.get('seller')) for x in products),
 'with_confirmed_point':sum(x.get('locationEvidence')=='confirmed-point' for x in products),
 'sources':hosts.most_common()
}
print(json.dumps(result,ensure_ascii=False))
d.close()
PY""")
finally:
    client.close()
