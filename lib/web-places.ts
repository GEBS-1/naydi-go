import {matchesMerchantSource} from './merchant-search-sources';
import {extractOffers,pageHit} from './offer-extraction';
import {env} from '@/lib/server-env';
import {routerCall} from './router-gateway';
import {cacheRead,cacheWrite} from './search-storage';
import {fetchSource} from './source-fetch';
import {businessLocations,resolveExactAddress} from './local-business';
import {geocode} from './osm-provider';
import {deduplicate,safeHTTP,parseIntent,matchesServicePlace,type SearchHit,type GeoPoint} from './city-search';
import {normalize} from './search';
import {relevantOffers} from './offer-relevance';
import {webSearchPayload} from './web-search-prompt';

const addressLookups=new Map<string,Promise<Awaited<ReturnType<typeof geocode>>>>();
let addressQueue:Promise<unknown>=Promise.resolve();
function addressLookup(query:string){
 const old=addressLookups.get(query);if(old)return old;
 const task=addressQueue.then(async()=>{
  try{return await geocode(query);}catch(error){
   if(!(error instanceof Error)||!error.message.includes('заняты'))return [];
   await new Promise(resolve=>setTimeout(resolve,1300));
   return geocode(query).catch(()=>[]);
  }
 });
 addressQueue=task;addressLookups.set(query,task);
 // Share overlapping requests, but retry later if another user held the provider lock.
 void task.finally(()=>setTimeout(()=>addressLookups.delete(query),15000));
 return task;
}
export async function locatePublishedBusinesses(hits:SearchHit[],city:string){
 for(const hit of hits.filter(h=>(h.kind==='store'||h.kind==='service'&&h.status==='organization')&&!h.point&&h.address).slice(0,2)){
  const places=await addressLookup(`${city}, ${hit.address}`);
  const exact=resolveExactAddress(places,city,hit.address!);
  if(exact){hit.point={lat:exact.lat,lng:exact.lng};hit.locationEvidence='confirmed-point';}
 }
 return hits;
}

/** Separate offline discovery: product search alone mostly returns nationwide catalogs. */
export async function searchWebPlaces(query:string,city:string,near?:GeoPoint,area?:string|null,sellerSites?:string[]):Promise<{hits:SearchHit[];status:string}>{
 if(!env.ROUTERAI_API_KEY||env.ROUTERAI_WEB_MODE==='off')return {hits:[],status:'not-configured'};
 const intent=parseIntent(query,city);
 const forService=intent.kind==='service';
 const matching=(hits:SearchHit[])=>forService
  ?hits.filter(hit=>hit.kind==='page'||matchesServicePlace(hit,intent)).map(hit=>hit.kind==='page'?hit:({...hit,kind:'service' as const,description:'Исполнитель найден на опубликованной странице. Стоимость и время записи уточните.'}))
  :hits;
 const key='offline-places:v5:'+normalize(city)+':'+(near?near.lat.toFixed(2)+','+near.lng.toFixed(2):'city')+':'+normalize(query)+':'+JSON.stringify(sellerSites||[]);
 const cached=await cacheRead<SearchHit[]>(key);if(cached){const relevant=matching(relevantOffers(cached,query,city));await locatePublishedBusinesses(relevant,city);return {hits:deduplicate(relevant,near),status:'cache'};}
 try{
  const answer=await routerCall({model:'perplexity/sonar',max_tokens:1000,temperature:0,
   messages:[{role:'system',content:sellerSites?.length?'Найди официальные страницы физических магазинов и самовывоза в указанном городе на сайтах из sellerSites. Возвращай только ссылки на эти сайты, где опубликован адрес точки. Не утверждай наличие товара в филиале.':forService?'Найди до 4 исполнителей именно запрошенной услуги в указанном городе. Дай прямые ссылки на официальные страницы исполнителей, где опубликованы услуга и адрес. Не возвращай магазины товаров или информационные статьи.': 'Найди до 4 реальных офлайн-магазинов или мастерских по запросу в указанном городе. Если есть местоположение, ищи поблизости. Нужны страницы конкретных физических точек: контакты, адреса филиалов на официальном сайте, Яндекс Картах или 2ГИС. Укажи ссылки на источники. Не возвращай только доставку, общие товарные каталоги или статьи. Не утверждай наличие товара в филиале без доказательств. Название, адрес, URL должны быть из найденного источника. Не выдумывай координаты.'},{role:'user',content:JSON.stringify({...webSearchPayload(query,city,near,area),...(sellerSites?.length?{sellerSites}:{})})}],
  },'chat/completions',sellerSites?.length?8000:undefined);
  const sources=[...(answer.search_results||[]),...(answer.choices?.[0]?.message.annotations||[]).flatMap(a=>a.type==='url_citation'&&a.url_citation?[{url:a.url_citation.url,title:a.url_citation.title||'',snippet:a.url_citation.content}]:[]),...(answer.citations||[]).map(url=>({url,title:'',snippet:undefined}))];
  const unique=new Map<string,typeof sources[number]>();
  for(const source of sources){
   const url=safeHTTP(source.url);
   if(url&&!unique.has(url)&&(!sellerSites?.length||sellerSites.some(site=>matchesMerchantSource(site,url))))unique.set(url,source);
  }
  const hits=(await Promise.all([...unique].slice(0,4).map(async ([url,source])=>{
   const html=await fetchSource(url);
   const businesses=html?relevantOffers(businessLocations(html,url,city),query,city).slice(0,6):[];
   // A place citation can point directly at the seller's product page.
   // Keep its observed offer instead of reducing it to a generic organization.
   const offers=html&&!forService?relevantOffers(extractOffers(html,url,city),query,city).slice(0,3):[];
   const relevant=matching([...offers,...businesses]);
   if(relevant.length||!forService)return relevant;
   const link=pageHit(url,source.title,city);
   const evidence=`${source.title} ${source.snippet||''}`;
   const cityRoot=normalize(city).replace(/[аяьй]$/u,'');
   const local=cityRoot.length>=3&&normalize(evidence).includes(cityRoot);
   return local&&matchesServicePlace({...link,kind:'store',title:evidence},intent)?[link]:[];
  }))).flat();
  await locatePublishedBusinesses(hits,city);
  const result=deduplicate(hits,near);await cacheWrite(key,result,result.length?6*3600000:120000);
  return {hits:result,status:'web-places'};
 }catch{return {hits:[],status:'unavailable'};}
}
