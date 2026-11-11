"""Repeat the reported public search after deployment; save a compact report."""
import importlib.util, pathlib, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
root=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('v',root/'scripts/vps-naydi.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
c=v.connect()
try:
 command="""cd /var/www/naydi-app/current && node --input-type=module - <<'JS'
const r=await fetch('https://naydigo.prepromo.ru/api/search',{method:'POST',headers:{Origin:'https://naydigo.prepromo.ru','Content-Type':'application/json'},body:JSON.stringify({query:'зимние мужские куртки',city:'Казань',near:{lat:55.7963,lng:49.1088}}),signal:AbortSignal.timeout(110000)});const b=await r.json();const photos=await Promise.all((b.hits||[]).filter(h=>h.kind==='product'&&h.image).slice(0,8).map(async h=>{const image=await fetch(new URL(h.image,'https://naydigo.prepromo.ru'),{signal:AbortSignal.timeout(35000)});return {status:image.status,type:image.headers.get('content-type'),bytes:(await image.arrayBuffer()).byteLength,url:h.image};}));console.log(JSON.stringify({http:r.status,photos,sources:b.sources,warnings:b.warnings,timing:b.timing,hits:b.hits?.map(h=>({kind:h.kind,title:h.title,price:h.price,image:!!h.image,model:h.model,characteristics:h.characteristics,rating:h.rating,site:h.site,address:h.address,point:h.point,locationEvidence:h.locationEvidence}))}));
JS"""
 _,out,err=c.exec_command(command,timeout=140)
 raw=out.read().decode();error=err.read().decode()
 if out.channel.recv_exit_status():raise RuntimeError(error)
 report=json.loads(raw.strip().splitlines()[-1])
 target=root/'artifacts/coat-map/live-report.json';target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False))
 assert report['http']==200
 assert report['photos'] and all(p['status']==200 and p['type'].startswith('image/') and p['bytes']>100 for p in report['photos']), 'Product photos failed'
 assert any(h['point'] and h['address'] and h['locationEvidence']=='confirmed-point' for h in report['hits']), 'No verified map points'
 assert any(h['kind']=='product' and h['image'] and h['price'] is not None and h['point'] for h in report['hits']), 'No located real catalog products'
 print('PASS live coat search: verified map points and priced photographed products')
finally:c.close()
