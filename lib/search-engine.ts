import {db} from '@/db';
import {resolveSearch,type SearchContext} from './search-context';
import {toSearchResult,type SearchResult} from './search-result';
import {budgetState} from './api-budget';
import {publicIndex} from './discovery-server';
import {localDiscovery} from './discovery';
import {normalize} from './search';
import {parseIntent,deduplicate,type SearchHit,type GeoPoint,type Intent} from './city-search';
import {findOrganizations,hidePrivate,type Bounds} from './osm-provider';
import {searchWeb} from './web-search-provider';
export type SearchRequest={query:string;city:string;near?:GeoPoint;bounds?:Bounds;context?:SearchContext};
export type SearchResponse={hits:SearchHit[];results:SearchResult[];context:SearchContext;intent:Intent;phase:'local'|'complete';sources:{osm:string;web:string};timing:{parseMs:number;localMs:number;externalMs:number;totalMs:number};warnings:string[]};
export async function runSearch(input:SearchRequest,emit?:(r:SearchResponse)=>void):Promise<SearchResponse>{
 const started=performance.now(),context=resolveSearch(input.query,input.context),intent=parseIntent(context.query,input.city),parseMs=performance.now()-started;
 const constrain=(list:SearchHit[])=>list.filter(h=>(context.maxPrice===undefined||h.price===null||h.price<=context.maxPrice)&&(context.radiusKm===undefined||h.distanceKm===null||h.distanceKm<=context.radiusKm)).sort((a,b)=>context.sort==='price'?(a.price??Infinity)-(b.price??Infinity):0);
 const present=(r:SearchResponse)=>{r.hits=constrain(r.hits);r.results=r.hits.map(toSearchResult).filter((h):h is SearchResult=>h!==null);return r;};
 const index=await publicIndex(),local=localDiscovery(index.products,index.shops,intent.query,input.city,input.near);
 const hits:SearchHit[]=local.offers.map(o=>({id:o.id,kind:o.kind,title:o.product.name,description:o.product.features||o.product.description,category:o.product.category,city:o.shop.city,address:o.address,point:o.shop.addressConfirmed?{lat:o.shop.lat,lng:o.shop.lng}:null,phone:o.shop.phone||null,site:o.shop.site||null,hours:o.shop.hours||null,source:o.source,checkedAt:o.checkedAt||'',price:o.product.price,image:o.product.photos[0]||null,status:o.confirmed?'seller-confirmed':'website',distanceKm:o.distanceKm,product:o.product,shop:o.shop}));
 for(const s of local.stores.filter(s=>!local.offers.some(o=>o.shop.id===s.id)))hits.push({id:s.id,kind:'store',title:s.name,description:s.description,category:s.category,city:s.city,address:s.street,point:s.addressConfirmed?{lat:s.lat,lng:s.lng}:null,phone:s.phone||null,site:s.site||null,hours:s.hours||null,source:s.source||'/#store/'+s.id,checkedAt:'',price:null,image:s.photos[0]||null,status:'organization',distanceKm:null,shop:s});
 if(intent.query){const rows=await db().prepare('SELECT data FROM external_places WHERE city=? AND (?="" OR category=?) AND checked_at>? LIMIT 300').bind(normalize(input.city),intent.category,intent.category,Date.now()-7*86400000).all<{data:string}>();for(const r of rows.results){const h=JSON.parse(r.data) as SearchHit;if(normalize(h.city)===normalize(input.city)&&(intent.category||normalize(h.title).includes(normalize(intent.query))))hits.push(h);}}
 let result:SearchResponse={results:[],context,hits:deduplicate(await hidePrivate(hits),input.near),intent,phase:'local',sources:{osm:'pending',web:'pending'},timing:{parseMs,localMs:performance.now()-started,externalMs:0,totalMs:performance.now()-started},warnings:[]};
 present(result);emit?.(result);
 if(intent.clarification.length||!intent.query){result={...result,phase:'complete',sources:{osm:'skipped',web:'skipped'}};emit?.(result);return result;}
 const ext=performance.now();const [osm,web]=await Promise.all([findOrganizations(intent,input.city,input.bounds).catch(()=>({hits:[] as SearchHit[],status:'unavailable'})),result.hits.some(h=>h.kind==='product'&&h.checkedAt&&Date.now()-Date.parse(h.checkedAt)<3600000)?Promise.resolve({hits:[] as SearchHit[],status:'index-sufficient'}):searchWeb(intent.query,input.city)]);
 const organizations=await hidePrivate(osm.hits);
 if(organizations.length)await db().batch(organizations.map(h=>db().prepare('INSERT INTO external_places(id,city,category,data,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET city=excluded.city,category=excluded.category,data=excluded.data,checked_at=excluded.checked_at').bind(h.id,normalize(h.city),intent.category,JSON.stringify(h),new Date(h.checkedAt).getTime())));
 // API web snippets are not persisted unless the provider contract grants storage rights.
 result={...result,hits:deduplicate(await hidePrivate([...organizations,...result.hits,...web.hits]),input.near),phase:'complete',sources:{osm:osm.status,web:web.status},timing:{...result.timing,externalMs:performance.now()-ext,totalMs:performance.now()-started},warnings:[]};
 if(['unavailable','busy','cooldown'].includes(osm.status))result.warnings.push('Поиск организаций временно недоступен или занят. Сохранённые результаты остаются в выдаче.');
 if(web.status==='not-configured')result.warnings.push('Полный веб-поиск не подключён. Показываем нашу базу, организации OpenStreetMap и указанные ими сайты. Конкретные товары и остатки уточняйте.');
 if(web.status==='unavailable')result.warnings.push('Веб-поиск: '+('error' in web?web.error:'временно недоступен'));
 if(context.maxPrice!==undefined)result.warnings.push(`Бюджет до ${context.maxPrice} ₽: предложения без цены и организации показаны отдельно; соответствие бюджету не подтверждено.`);
 if(context.newOnly)result.warnings.push('У источников нет подтверждённого состояния товара. Условие «только новые» требует проверки у продавца.');
 if(context.radiusKm&&!input.near)result.warnings.push('Для ограничения радиуса укажите начальный адрес или разрешите геолокацию.');
 present(result);
 const budget=await budgetState();if(budget.warning)result.warnings.push(`Использовано или зарезервировано ${budget.warning}% месячного бюджета API. ${budget.warning===100?'Платный поиск остановлен.':''}`);
 await db().batch([db().prepare('INSERT INTO searches(id,query,result_count,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),input.query,result.hits.length,new Date().toISOString()),db().prepare('INSERT INTO search_metrics(id,data,created_at) VALUES(?,?,?)').bind(crypto.randomUUID(),JSON.stringify({timing:result.timing,sources:result.sources,count:result.hits.length,llmCalls:null,tokens:null,cost:null,accounting:'api_calls ledger; per-search attribution unavailable'}),Date.now())]);
 emit?.(result);return result;
}
