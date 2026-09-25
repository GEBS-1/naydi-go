import {env} from 'cloudflare:workers';
import {db} from '@/db';
import {recordFreeCall} from './api-budget';

import {cacheRead,cacheWrite,acquireProvider,releaseProvider} from './search-storage';
import {canonical,safeHTTP,type Intent,type SearchHit,type GeoPoint} from './city-search';
import {quota} from './discovery-server';
export type Bounds=[number,number,number,number];
type Place=GeoPoint&{label:string;city?:string;extent?:number[]};
export async function geocode(query:string,cityOnly=false):Promise<Place[]>{
 const key='photon:'+query.toLowerCase()+':'+cityOnly,cached=await cacheRead<Place[]>(key);if(cached)return cached;
 if(!await acquireProvider('photon',12000))throw new Error('Подсказки заняты. Повторите через несколько секунд.');
 const began=performance.now();let success=false;
 try{const u=new URL((env.PHOTON_URL||'https://photon.komoot.io')+'/api/');u.search=new URLSearchParams({q:query,limit:'5',lang:'default'}).toString();
 u.searchParams.delete('lang');const r=await fetch(u,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru; local-prototype)'}});if(!r.ok)throw Error('geocoder');
 const b=await r.json() as {features:{geometry:{coordinates:number[]};properties:Record<string,unknown>}[]};
 const places=b.features.filter(f=>!cityOnly||['city','town','village','hamlet','municipality','administrative'].includes(String(f.properties.osm_value))).map(f=>{const p=f.properties;return {lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],label:[p.city,[p.street,p.housenumber].filter(Boolean).join(' '),p.name,p.state,p.country].filter(Boolean).join(', '),city:String(p.city||p.name||''),extent:Array.isArray(p.extent)?p.extent as number[]:undefined};}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
 await cacheWrite(key,places,7*86400000);success=true;return places;
 }finally{await releaseProvider('photon',1200);await recordFreeCall('photon',performance.now()-began,success?'complete':'error');}
}
export async function cityBounds(city:string):Promise<Bounds>{const p=(await geocode(city,true))[0];if(!p)throw new Error('Город не найден. Уточните его название.');if(p.extent&&p.extent.length===4){const [west,north,east,south]=p.extent;if(east-west<3&&north-south<2)return [south,west,north,east];}return [p.lat-.14,p.lng-.23,p.lat+.14,p.lng+.23];}
type OSM={type:'node'|'way'|'relation';id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};
export function osmHits(elements:OSM[],city:string,intent:Intent):SearchHit[]{return elements.flatMap(e=>{const t=e.tags||{},lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon;if(!t.name||lat===undefined||lng===undefined)return [];
 const street=[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),address=t['addr:full']||street||null;
 return [{id:`osm:${e.type}:${e.id}`,kind:intent.kind==='service'?'service':'store',title:t.name,description:intent.kind==='product'?'Магазин подходящей категории. Конкретный товар и наличие уточняйте у продавца.':'Организация из OpenStreetMap. Услуги и часы работы уточняйте.',category:intent.category||t.shop||t.craft||t.amenity||'',city:t['addr:city']||city,address,point:address?{lat,lng}:null,phone:t['contact:phone']||t.phone||null,site:safeHTTP(t['contact:website']||t.website),hours:t.opening_hours||null,source:`https://www.openstreetmap.org/${e.type}/${e.id}`,checkedAt:new Date().toISOString(),price:null,image:null,status:'organization',distanceKm:null} satisfies SearchHit];});}
export async function findOrganizations(intent:Intent,city:string,bounds?:Bounds):Promise<{hits:SearchHit[];status:string}>{
 if(!intent.query||intent.clarification.length)return {hits:[],status:'skipped'};
 const box=bounds||await cityBounds(city);const boxKey=box.map(n=>n.toFixed(3)).join(',');
 // Safe regex built from literal words, never accept Overpass syntax from a client or LLM.
 const word=intent.query.replace(/[.*+?^${}()|[\]\\"\n\r]/g,' ').trim().slice(0,80);
 const selectors=intent.selectors.length?intent.selectors:[`["name"~"${word}",i][~"^(shop|craft|amenity|office|tourism)$"~"."]`];
 const key='osm:v2:'+boxKey+':'+selectors.join('|'),cached=await cacheRead<{elements:OSM[];checkedAt:string}>(key);
 if(cached)return {hits:osmHits(cached.elements,bounds?'':city,intent).map(h=>({...h,checkedAt:cached.checkedAt})),status:'cache'};
 if(await cacheRead('backoff:overpass'))return {hits:[],status:'cooldown'};
 if(!await acquireProvider('overpass',30000))return {hits:[],status:'busy'};
 const began=performance.now();let success=false;
 try{await quota('global','overpass',30);const query=`[out:json][timeout:12][maxsize:2097152];(${selectors.map(s=>`nwr${s}(${box.join(',')});`).join('')});out center tags 150;`;
 const r=await fetch(env.OVERPASS_URL||'https://overpass.kumi.systems/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru; local-prototype)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw Error('overpass');const body=await r.json() as {elements:OSM[];remark?:string};if(body.remark||!Array.isArray(body.elements))throw Error('incomplete');
 await cacheWrite(key,{elements:body.elements,checkedAt:new Date().toISOString()},86400000);success=true;return {hits:osmHits(body.elements,bounds?'':city,intent),status:'live'};
 }catch{await cacheWrite('backoff:overpass',true,60000);return {hits:[],status:'unavailable'};}finally{await releaseProvider('overpass',3000);await recordFreeCall('overpass',performance.now()-began,success?'complete':'error');}
}
export async function hidePrivate(hits:SearchHit[]){const rows=await db().prepare("SELECT data FROM shops WHERE visibility='draft'").all<{data:string}>();const blocked=rows.results.map(r=>JSON.parse(r.data) as {name:string;site?:string});return hits.filter(h=>!blocked.some(s=>canonical(s.name)===canonical(h.title)||(safeHTTP(s.site)&&h.site&&new URL(safeHTTP(s.site)!).hostname===new URL(h.site).hostname)));}
