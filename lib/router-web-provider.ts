import {relevantOffers} from './offer-relevance';
import {queryVariants} from './query-variants';
import {normalize} from './search';
import {resolveSearch} from './search-context';
import {deduplicate} from './city-search';
import {cacheHit} from './search-usage';
import {env} from 'cloudflare:workers';
import {routerCall} from './router-gateway';
import {extractOffers,indexedOfferHit} from './offer-extraction';
import {fetchSource} from './source-fetch';
import {safeHTTP,type SearchHit} from './city-search';
import type {WebSearchProvider} from './web-search-provider';
import {cacheRead,cacheWrite} from './search-storage';
function baseProvider():WebSearchProvider|null{if(!env.ROUTERAI_API_KEY||env.ROUTERAI_WEB_MODE==='off')return null;const plugin=env.ROUTERAI_WEB_MODE?.startsWith('plugin');return {name:plugin?'routerai-web-'+(env.ROUTERAI_WEB_MODE==='plugin-native'?'native':'exa'):'routerai-sonar',async search(query,city){const key='web:offers-v5:'+this.name+':'+normalize(city)+':'+normalize(query),cached=await cacheRead<SearchHit[]>(key);if(cached){cacheHit();return relevantOffers(cached,query,city);}const answer=await routerCall({model:plugin?(env.ROUTERAI_WEB_MODEL||env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507'):'perplexity/sonar',max_tokens:1800,temperature:0.1,...(plugin?{plugins:[{id:'web',engine:env.ROUTERAI_WEB_MODE==='plugin-native'?'native':'exa',max_results:3}]}:{}),messages:[{role:'system',content:'Ты выполняешь покупательский поиск. Найди 3–5 конкретных карточек товаров у продавцов или страницы конкретных услуг в указанном городе. Не возвращай статьи, инструкции, обзоры, рейтинги, форумы, видео и материалы «как сделать»: они не являются предложениями купить. Для задачи пользователя ищи конечный покупаемый товар, а не справочный материал о задаче. Для подарка предлагай конкретные товары. Предпочитай первоисточники продавцов с опубликованной ценой. Учитывай бюджет. Используй ссылки на первоисточники. Не выдумывай цены, адреса и наличие. Страница товара не подтверждает наличие в филиале. Если товарных источников нет, прямо сообщи об этом и не заполняй ответ статьями.'},{role:'user',content:JSON.stringify({query,city})}]});
 const sources=[...(answer.search_results||[]),...(answer.choices?.[0]?.message.annotations||[]).flatMap(a=>a.type==='url_citation'&&a.url_citation?[{url:a.url_citation.url,title:a.url_citation.title||'Источник предложения',snippet:a.url_citation.content}]:[]),...(answer.citations||[]).map(url=>({url,title:new URL(safeHTTP(url)||'https://invalid.local').hostname,snippet:''}))];
 const unique=Array.from(new Map(sources.filter(s=>safeHTTP(s.url)).map(s=>[s.url,s])).values());
 const hits=(await Promise.all(unique.slice(0,4).map(async s=>{const html=await fetchSource(s.url),offers=html?extractOffers(html,s.url,city):[];return offers.length?offers:[indexedOfferHit(s.url,s.title,s.snippet,city)];}))).flat();
 // Store only links and short provenance, never a generated answer as inventory.
 const relevant=relevantOffers(hits,query,city);await cacheWrite(key,relevant,1800000);return relevant;
 }};}
export function routerWebProvider():WebSearchProvider|null{
 const base=baseProvider();if(!base)return null;
 return {name:base.name,async search(query,city){
  const key='web:planned-v4:'+base.name+':'+normalize(city)+':'+normalize(query),cached=await cacheRead<SearchHit[]>(key);if(cached){cacheHit();return relevantOffers(cached,query,city);}
  const hits=await base.search(query,city),budget=resolveSearch(query).maxPrice;
  const useful=()=>hits.some(h=>h.kind==='product'&&h.price!==null&&(budget===undefined||h.price<=budget)&&h.sourceAvailability!=='out_of_stock');
  if(/подар|подобрать|посовет/iu.test(query)&&!useful()){
   try{for(const variant of await queryVariants(query,city)){hits.push(...await base.search(variant,city));if(useful())break;}}catch{/* Keep already verified sources on model/budget/provider failure. */}
  }
  const result=deduplicate(relevantOffers(hits,query,city));await cacheWrite(key,result,1800000);return result;
 }};
}
