import {matchesServicePlace} from './city-search';
import {env} from '@/lib/server-env';
import {db} from '@/db';
import {recordFreeCall} from './api-budget';

import {cacheRead,cacheWrite,acquireProvider,releaseProvider} from './search-storage';
import {canonical,safeHTTP,type Intent,type SearchHit,type GeoPoint} from './city-search';
import {quota} from './discovery-server';
import {normalize} from './search';
export type Bounds=[number,number,number,number];
type Place=GeoPoint&{label:string;city?:string;region?:string;street?:string;extent?:number[]};
export async function reverseLocation(point?:GeoPoint):Promise<string|null>{
 if(!point)return null;
 const key=`photon:reverse:v1:${point.lat.toFixed(2)}:${point.lng.toFixed(2)}`,cached=await cacheRead<string|null>(key);if(cached!==null)return cached;
 try{
  const url=new URL((env.PHOTON_URL||'https://photon.komoot.io')+'/reverse');url.search=new URLSearchParams({lat:String(point.lat),lon:String(point.lng),limit:'1'}).toString();
  const response=await fetch(url,{signal:AbortSignal.timeout(1800),headers:{Accept:'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)'}});if(!response.ok)return null;
  const data=await response.json() as {features?:{properties:Record<string,unknown>}[]};const props=data.features?.[0]?.properties;if(!props||String(props.countrycode||'').toUpperCase()!=='RU')return null;
  const area=[props.district,props.suburb,props.street].filter(x=>typeof x==='string'&&x.trim()).join(', ')||null;await cacheWrite(key,area,6*3600000);return area;
 }catch{return null;}
}
export async function geocode(query:string,cityOnly=false):Promise<Place[]>{
 const key='photon:ru:v3:'+query.toLowerCase()+':'+cityOnly,cached=await cacheRead<Place[]>(key);if(cached)return cached;
 if(!await acquireProvider('photon',12000))throw new Error('Подсказки заняты. Повторите через несколько секунд.');
 const began=performance.now();let success=false;
 try{const u=new URL((env.PHOTON_URL||'https://photon.komoot.io')+'/api/');u.search=new URLSearchParams({q:query,limit:'5',lang:'default'}).toString();
 u.searchParams.delete('lang');u.searchParams.set('countrycode','RU');if(cityOnly)u.searchParams.set('q',query+', Россия');const r=await fetch(u,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru; local-prototype)'}});if(!r.ok)throw Error('geocoder');
 const b=await r.json() as {features:{geometry:{coordinates:number[]};properties:Record<string,unknown>}[]};
 const places=b.features.filter(f=>String(f.properties.countrycode).toUpperCase()==='RU'&&(!cityOnly||['city','town','village','hamlet','municipality','administrative'].includes(String(f.properties.osm_value)))).map(f=>{const p=f.properties;return {lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],label:[p.city,[p.street,p.housenumber].filter(Boolean).join(' '),p.name,p.state,p.country].filter(Boolean).join(', '),city:String(cityOnly?p.name||p.city||'':p.city||p.name||''),region:String(p.state||''),street:[p.street,p.housenumber].filter(Boolean).join(' '),extent:Array.isArray(p.extent)?p.extent as number[]:undefined};}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
 await cacheWrite(key,places,7*86400000);success=true;return places;
 }finally{await releaseProvider('photon',1200);await recordFreeCall('photon',performance.now()-began,success?'complete':'error');}
}
export async function cityBounds(city:string):Promise<Bounds>{const p=(await geocode(city,true))[0];if(!p)throw new Error('Город не найден. Уточните его название.');if(p.extent&&p.extent.length===4){const [west,north,east,south]=p.extent;if(east-west<3&&north-south<2)return [south,west,north,east];}return [p.lat-.14,p.lng-.23,p.lat+.14,p.lng+.23];}
type OSM={type:'node'|'way'|'relation';id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};
export function osmHits(elements:OSM[],city:string,intent:Intent):SearchHit[]{return elements.flatMap(e=>{const t=e.tags||{},lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon;if(!t.name||lat===undefined||lng===undefined)return [];
 const street=[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),address=t['addr:full']||street||null;
 const osmCategory=intent.category==='Ремонт велосипедов'&&t['service:bicycle:repair']==='yes'?'bicycle_repair':t.shop||t.craft||t.amenity||intent.category||'';
 return [{id:`osm:${e.type}:${e.id}`,kind:intent.kind==='service'?'service':'store',title:t.name,description:intent.kind==='product'?'Магазин подходящей категории. Конкретный товар и наличие уточняйте у продавца.':'Организация из OpenStreetMap. Услуги и часы работы уточняйте.',category:osmCategory,city:t['addr:city']||city,address,point:address?{lat,lng}:null,phone:t['contact:phone']||t.phone||null,site:safeHTTP(t['contact:website']||t.website),sellerLinks:[t['contact:vk'],t['contact:telegram']].flatMap(value=>safeHTTP(value)||[]),hours:t.opening_hours||null,source:`https://www.openstreetmap.org/${e.type}/${e.id}`,checkedAt:new Date().toISOString(),price:null,image:safeHTTP(t['contact:image']||t.image),status:'organization',distanceKm:null,locationEvidence:address?'confirmed-point':undefined} satisfies SearchHit];});}
async function photonOrganizations(intent:Intent,city:string,box:Bounds):Promise<SearchHit[]>{
 const query=intent.category||intent.query;
 const key='photon:places:v2:'+intent.kind+':'+normalize(city)+':'+normalize(query)+':'+box.map(n=>n.toFixed(2)).join(',');
 const cached=await cacheRead<SearchHit[]>(key);if(cached)return cached;
 const url=new URL((env.PHOTON_URL||'https://photon.komoot.io')+'/api/');
 url.search=new URLSearchParams({q:query,limit:'50',countrycode:'RU',lat:String((box[0]+box[2])/2),lon:String((box[1]+box[3])/2),zoom:'12'}).toString();
 const response=await fetch(url,{signal:AbortSignal.timeout(5000),headers:{Accept:'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)'}});
 if(!response.ok)throw Error('photon');
 const data=await response.json() as {features?:{geometry:{coordinates:number[]};properties:Record<string,unknown>}[]};
 const hits=(data.features||[]).flatMap(feature=>{
  const p=feature.properties,lat=Number(feature.geometry.coordinates[1]),lng=Number(feature.geometry.coordinates[0]);
  if(p.countrycode!=='RU'||normalize(String(p.city||''))!==normalize(city)||!(intent.kind==='service'?['shop','craft','amenity'].includes(String(p.osm_key)):p.osm_key==='shop')||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<box[0]||lat>box[2]||lng<box[1]||lng>box[3])return [];
  const name=String(p.name||'').trim(),street=String(p.street||'').trim(),house=String(p.housenumber||'').trim();
  if(!name||!street)return [];
  const osmType=({N:'node',W:'way',R:'relation'} as Record<string,string>)[String(p.osm_type)]||'node';
  return [{id:`osm:${osmType}:${p.osm_id}`,kind:intent.kind==='service'?'service':'store',title:name,description:intent.kind==='service'?'Исполнитель поблизости. Стоимость и время записи уточните.':'Подходящий магазин поблизости. Наличие товара уточните у продавца.',category:String(p.osm_value||''),city,address:[street,house].filter(Boolean).join(', '),point:{lat,lng},phone:null,site:null,hours:null,source:`https://www.openstreetmap.org/${osmType}/${p.osm_id}`,checkedAt:new Date().toISOString(),price:null,image:null,status:'organization',distanceKm:null,locationEvidence:'confirmed-point'} satisfies SearchHit];
 });
 const relevant=intent.kind==='service'?hits.filter(h=>matchesServicePlace(h,intent)):hits;
 await cacheWrite(key,relevant,6*3600000);return relevant;
}
export async function findOrganizations(intent:Intent,city:string,bounds?:Bounds):Promise<{hits:SearchHit[];status:string}>{
 if(!intent.query||intent.clarification.length)return {hits:[],status:'skipped'};
 const box=bounds||await cityBounds(city);const boxKey=box.map(n=>n.toFixed(3)).join(',');
 // Safe regex built from literal words, never accept Overpass syntax from a client or LLM.
 const word=intent.query.replace(/[.*+?^${}()|[\]\\"\n\r]/g,' ').trim().slice(0,80);
 const selectors=intent.selectors.length?intent.selectors:[`["name"~"${word}",i][~"^(shop|craft|amenity|office|tourism)$"~"."]`];
 const key='osm:v3:'+city.trim().toLowerCase()+':'+boxKey+':'+selectors.join('|'),cached=await cacheRead<{elements:OSM[];checkedAt:string}>(key);
 if(cached)return {hits:osmHits(cached.elements,city,intent).map(h=>({...h,checkedAt:cached.checkedAt})),status:'cache'};
 // Photon can return addressable OSM shops quickly. Use that result before
 // waiting on an overloaded Overpass endpoint; never infer stock from it.
 const photon=await photonOrganizations(intent,city,box).catch(()=>[]);
 if(photon.length)return {hits:photon,status:'photon'};
 if(await cacheRead('backoff:overpass'))return {hits:[],status:'unavailable'};
 if(!await acquireProvider('overpass',30000))return {hits:[],status:'busy'};
 const began=performance.now();let success=false;
 try{await quota('global','overpass',30);const query=`[out:json][timeout:8][maxsize:2097152];(${selectors.map(s=>`nwr${s}(${box.join(',')});`).join('')});out center tags 150;`;
 const r=await fetch(env.OVERPASS_URL||'https://overpass.kumi.systems/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru; local-prototype)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(9500)});
 if(!r.ok)throw Error('overpass');const body=await r.json() as {elements:OSM[];remark?:string};if(body.remark||!Array.isArray(body.elements))throw Error('incomplete');
 await cacheWrite(key,{elements:body.elements,checkedAt:new Date().toISOString()},86400000);success=true;return {hits:osmHits(body.elements,city,intent),status:'live'};
 }catch{await cacheWrite('backoff:overpass',true,60000);const hits=await photonOrganizations(intent,city,box).catch(()=>[]);return {hits,status:hits.length?'photon-fallback':'unavailable'};}finally{await releaseProvider('overpass',3000);await recordFreeCall('overpass',performance.now()-began,success?'complete':'error');}
}
export async function hidePrivate(hits:SearchHit[]){const rows=await db().prepare("SELECT data FROM shops WHERE visibility='draft'").all<{data:string}>();const blocked=rows.results.map(r=>JSON.parse(r.data) as {name:string;site?:string});return hits.filter(h=>!blocked.some(s=>canonical(s.name)===canonical(h.title)||(safeHTTP(s.site)&&h.site&&new URL(safeHTTP(s.site)!).hostname===new URL(h.site).hostname)));}
