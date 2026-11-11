"""Read-only source/cache diagnosis plus one ordinary search for the reported query."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v);c=v.connect()
try:
 v.run(c,"""cd /var/www/naydi-app/current && node --input-type=module - <<'JS'
import {Pool} from 'pg';import {postgresSettings} from './scripts/postgres-migrate.mjs';
const env=postgresSettings(),p=new Pool({connectionString:env.DATABASE_URL,max:1});
try{
 console.log('CONFIG',JSON.stringify({webMode:env.ROUTERAI_WEB_MODE||'sonar',aiConfigured:!!env.ROUTERAI_API_KEY,photon:env.PHOTON_URL||'https://photon.komoot.io',overpass:env.OVERPASS_URL||'https://overpass.kumi.systems/api/interpreter'}));
 const caches=await p.query("SELECT id,data,expires_at FROM search_cache WHERE id ILIKE '%зимн%куртк%' OR id ILIKE 'photon:%зинин%' ORDER BY expires_at DESC LIMIT 8");
 for(const row of caches.rows){let data;try{data=JSON.parse(row.data)}catch{continue}console.log('CACHE',JSON.stringify({key:row.id,expires:row.expires_at,items:Array.isArray(data)?data.map(h=>({id:h.id,kind:h.kind,title:h.title,address:h.address,point:h.point,city:h.city,source:h.source,site:h.site,locationEvidence:h.locationEvidence,label:h.label,shopPoint:h.shop?{lat:h.shop.lat,lng:h.shop.lng,confirmed:h.shop.addressConfirmed}:undefined})):undefined}));}
 const metrics=await p.query("SELECT data FROM search_metrics WHERE data ILIKE '%зимн%куртк%' ORDER BY created_at DESC LIMIT 3");for(const r of metrics.rows){let m;try{m=JSON.parse(r.data)}catch{continue}console.log('METRIC',JSON.stringify({query:m.query,city:m.city,count:m.count,sources:m.sources,warnings:m.warnings,timing:m.timing}));}
 const calls=await p.query("SELECT provider,model,status,COUNT(*) AS calls FROM api_calls WHERE created_at>$1 AND provider IN ('seller-catalog','photon','overpass') GROUP BY provider,model,status",[Date.now()-86400000]);console.log('FREE_SOURCES',JSON.stringify(calls.rows));
}finally{await p.end()}
const r=await fetch('https://naydigo.prepromo.ru/api/search?qa=1',{method:'POST',headers:{Origin:'https://naydigo.prepromo.ru','Content-Type':'application/json'},body:JSON.stringify({query:'зимние мужские куртки',city:'Казань',near:{lat:55.7963,lng:49.1088}}),signal:AbortSignal.timeout(100000)});const b=await r.json();console.log('REPLAY',JSON.stringify({http:r.status,sources:b.sources,warnings:b.warnings,intent:b.intent,timing:b.timing,hits:b.hits?.map(h=>({id:h.id,kind:h.kind,title:h.title,source:h.source,site:h.site,address:h.address,point:h.point,locationEvidence:h.locationEvidence,shop:h.shop?{id:h.shop.id,street:h.shop.street,lat:h.shop.lat,lng:h.shop.lng,confirmed:h.shop.addressConfirmed}:undefined}))}));
JS""")
finally:c.close()
