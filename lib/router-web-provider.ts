import {searchCatalogPages} from './catalog-page-search';
import {matchesMerchantSource,merchantSearchSources} from './merchant-search-sources';
import {enrichOffers} from './offer-enrichment';
import {relevantOffers} from './offer-relevance';
import {queryVariants} from './query-variants';
import {normalize} from './search';
import {resolveSearch} from './search-context';
import {deduplicate} from './city-search';
import {cacheHit} from './search-usage';
import {env} from '@/lib/server-env';
import {routerCall} from './router-gateway';
import {extractOffers,indexedOfferHit} from './offer-extraction';
import {fetchSource} from './source-fetch';
import {safeHTTP,type SearchHit,type GeoPoint} from './city-search';
import type {WebSearchProvider} from './web-search-provider';
import {cacheRead,cacheWrite} from './search-storage';
import {WEB_SEARCH_PROMPT_VERSION,WEB_SEARCH_SYSTEM_PROMPT,webSearchPayload} from './web-search-prompt';
import {businessLocations} from './local-business';
import {locatePublishedBusinesses} from './web-places';
function nearKey(near?:GeoPoint){return near?':'+near.lat.toFixed(2)+','+near.lng.toFixed(2):'';}
function repairProductLinks(hits:SearchHit[]):SearchHit[]{return hits.map(hit=>{
 if(hit.kind!=='product'||!hit.site||!hit.source)return hit;
 const source=safeHTTP(hit.source),site=safeHTTP(hit.site);
 if(!source||!site||source===site||new URL(source).hostname!==new URL(site).hostname)return hit;
 return {...hit,source:site};
});}
function productPageFirst<T extends {url:string;title:string;snippet?:string}>(items:T[],city:string){
 const direct=/\/(?:product|products|tovar|item|goods|p)\/[^/]+|\/catalog\/[^/]+\/[^/]+/iu;
 const listing=/(?:^|\/)(?:catalog|category|categories|brand|brands|search|tag|sale|aktsii|catalogue)(?:\/|$)/iu;
 return items.sort((a,b)=>{
  const score=(x:T)=>Number(indexedOfferHit(x.url,x.title,x.snippet,city).kind==='product')*8+Number(direct.test(new URL(x.url).pathname)&&!listing.test(new URL(x.url).pathname))*4+Number(/\d[\d\s .,]*\s*(?:₽|руб(?:\.|лей)?)/iu.test(`${x.title} ${x.snippet||''}`))*2;
  return score(b)-score(a);
 });
}
type SearchScope={sources?:string[];hint?:string};
type BaseProvider={name:string;search(query:string,city:string,near?:GeoPoint,nearArea?:string|null,scope?:SearchScope):Promise<SearchHit[]>};
function baseProvider():BaseProvider|null{
 if(!env.ROUTERAI_API_KEY||env.ROUTERAI_WEB_MODE==='off')return null;
 const plugin=env.ROUTERAI_WEB_MODE?.startsWith('plugin');
 return {name:plugin?'routerai-web-'+(env.ROUTERAI_WEB_MODE==='plugin-native'?'native':'exa'):'routerai-sonar',async search(query,city,near,nearArea,scope){
  const key='web:offers-'+WEB_SEARCH_PROMPT_VERSION+':'+this.name+':'+normalize(city)+nearKey(near)+':'+normalize(nearArea||'')+':'+normalize(query)+':'+JSON.stringify(scope||{});
  const cached=await cacheRead<SearchHit[]>(key);
  if(cached){cacheHit();if(!scope?.sources)await locatePublishedBusinesses(cached,city);return relevantOffers(repairProductLinks(cached),query,city);}
  const answer=await routerCall({
   model:plugin?(env.ROUTERAI_WEB_MODEL||env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507'):'perplexity/sonar',
   max_tokens:1800,temperature:0.1,
   ...(plugin?{plugins:[{id:'web',engine:env.ROUTERAI_WEB_MODE==='plugin-native'?'native':'exa',max_results:3}]}:{}),
   messages:[{role:'system',content:WEB_SEARCH_SYSTEM_PROMPT},{role:'user',content:JSON.stringify({...webSearchPayload(query,city,near,nearArea),
    ...(scope?.sources?{sellerSources:scope.sources,instruction:'Ищи конкретные товары только на указанных сайтах или в указанных открытых сообществах.'}:{}),
    ...(scope?.hint?{instruction:scope.hint}:{})})}],
  },'chat/completions',scope?8000:undefined);
 const sources=[...(answer.search_results||[]),...(answer.choices?.[0]?.message.annotations||[]).flatMap(a=>a.type==='url_citation'&&a.url_citation?[{url:a.url_citation.url,title:a.url_citation.title||'Источник предложения',snippet:a.url_citation.content}]:[]),...(answer.citations||[]).map(url=>({url,title:new URL(safeHTTP(url)||'https://invalid.local').hostname,snippet:''}))];
 const uniqueSources=new Map<string,typeof sources[number]>();
 for(const source of sources){
  const url=safeHTTP(source.url);
  if(!url||uniqueSources.has(url))continue;
  if(scope?.sources&&!scope.sources.some(merchant=>matchesMerchantSource(merchant,url)))continue;
  uniqueSources.set(url,{...source,url});
 }
 const unique=productPageFirst([...uniqueSources.values()],city);
 const documents=await Promise.all(unique.slice(0,scope?.sources?4:6).map(async source=>({
  ...source,html:await fetchSource(source.url),
 })));
 const hits=(await Promise.all(documents.map(async source=>{
  const {html,url,title,snippet}=source;
  const offers=html?extractOffers(html,url,city):[];
  const places=html?businessLocations(html,url,city).slice(0,6):[];
  const products=scope?.sources?offers:await enrichOffers(offers);
  return [...(products.length?products:[indexedOfferHit(url,title,snippet,city)]),...places];
 }))).flat();
 const verified=relevantOffers(hits,query,city).some(hit=>hit.kind==='product'&&hit.evidence==='source-page');
 if(!verified){
  const pages=documents.flatMap(({url,html})=>html?[{url,html}]:[]);
  hits.push(...await searchCatalogPages(pages,query,city));
 }
 if(!scope?.sources)await locatePublishedBusinesses(hits,city);
 // Store only links and short provenance, never a generated answer as inventory.
 const relevant=relevantOffers(hits,query,city);await cacheWrite(key,relevant,1800000);return relevant;
  }};}
export function routerWebProvider():WebSearchProvider|null{
 const base=baseProvider();if(!base)return null;
 return {name:base.name,async search(query,city,near,nearArea,onPartial){
 const key='web:planned-'+WEB_SEARCH_PROMPT_VERSION+':'+base.name+':'+normalize(city)+nearKey(near)+':'+normalize(nearArea||'')+':'+normalize(query),cached=await cacheRead<SearchHit[]>(key);if(cached){cacheHit();await locatePublishedBusinesses(cached,city);return relevantOffers(repairProductLinks(cached),query,city);}
  const started=performance.now();
  const hits=await base.search(query,city,near,nearArea),budget=resolveSearch(query).maxPrice;
  if(hits.length)await onPartial?.(hits);
  const firstProducts=hits.filter(hit=>hit.kind==='product');
  const firstHosts=new Set(firstProducts.map(hit=>new URL(hit.source).hostname.replace(/^www\./,'')));
  if(firstProducts.length>=2&&firstHosts.size===1&&!/-site:/iu.test(query)&&performance.now()-started<8000){
   const dominant=[...firstHosts][0];
   try{hits.push(...(await base.search(`${query} -site:${dominant}`,city,near,nearArea)).filter(hit=>new URL(hit.source).hostname.replace(/^www\./,'')!==dominant));}catch{/* Keep the first seller if a second source is unavailable. */}
  }
  if(!hits.some(h=>h.kind==='product')&&!/аренд|прокат|напрокат/iu.test(query)&&performance.now()-started<8000){
   const categoryHosts=[...new Set(hits.filter(h=>h.kind==='page').map(h=>new URL(h.source).hostname.replace(/^www\./,'')))].slice(0,2);
   const exclusions=categoryHosts.map(host=>`-site:${host}`).join(' ');
   try{hits.push(...await base.search(query,city,near,nearArea,{hint:`Найди прямые ссылки на конкретные предложения о продаже. Исключи каталоги без карточек и аренду. ${exclusions}`}));}catch{/* Keep the first source result if the retry fails. */}
  }
  const useful=()=>hits.some(h=>h.kind==='product'&&h.price!==null&&(budget===undefined||h.price<=budget)&&h.sourceAvailability!=='out_of_stock');
  if(/подар|подобрать|посовет/iu.test(query)&&!useful()){
   try{for(const variant of await queryVariants(query,city)){hits.push(...await base.search(variant,city,near,nearArea));if(useful())break;}}catch{/* Keep already verified sources on model/budget/provider failure. */}
  }
  const result=deduplicate(relevantOffers(hits,query,city));await cacheWrite(key,result,1800000);return result;
 }};
}


export async function searchNearbyMerchants(query:string,city:string,places:SearchHit[],near?:GeoPoint,area?:string|null){
 const sources=merchantSearchSources(places,city,near);
 if(!sources.length)return [];
 const provider=baseProvider();
 if(!provider)return [];
 const hits=await provider.search(query,city,near,area,{sources});
 return hits.filter(hit=>hit.kind==='product'&&sources.some(source=>matchesMerchantSource(source,hit.site||hit.source)));
}
