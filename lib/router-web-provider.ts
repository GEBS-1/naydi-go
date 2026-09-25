import {env} from 'cloudflare:workers';
import {routerCall} from './router-gateway';
import {safeHTTP,type SearchHit} from './city-search';
import type {WebSearchProvider} from './web-search-provider';
import {cacheRead,cacheWrite} from './search-storage';
export function routerWebProvider():WebSearchProvider|null{if(!env.ROUTERAI_API_KEY||env.ROUTERAI_WEB_MODE==='off')return null;const plugin=env.ROUTERAI_WEB_MODE?.startsWith('plugin');return {name:plugin?'routerai-web-'+(env.ROUTERAI_WEB_MODE==='plugin-native'?'native':'exa'):'routerai-sonar',async search(query,city){const key='web:'+this.name+':'+city+':'+query,cached=await cacheRead<SearchHit[]>(key);if(cached)return cached;const answer=await routerCall({model:plugin?(env.ROUTERAI_WEB_MODEL||env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507'):'perplexity/sonar',max_tokens:1800,temperature:0.1,...(plugin?{plugins:[{id:'web',engine:env.ROUTERAI_WEB_MODE==='plugin-native'?'native':'exa',max_results:3}]}:{}),messages:[{role:'system',content:'Найди конкретные предложения товаров, услуг или организаций в указанном городе. Используй веб-поиск, давай ссылки на первоисточники. Не выдумывай цены, адреса, наличие. Страница товара не подтверждает наличие в филиале. Если источников нет, прямо сообщи об этом.'},{role:'user',content:JSON.stringify({query,city})}]});
 const sources=[...(answer.search_results||[]),...(answer.choices?.[0]?.message.annotations||[]).flatMap(a=>a.type==='url_citation'&&a.url_citation?[{url:a.url_citation.url,title:a.url_citation.title||'Источник предложения',snippet:a.url_citation.content}]:[]),...(answer.citations||[]).map(url=>({url,title:new URL(safeHTTP(url)||'https://invalid.local').hostname,snippet:''}))];
 const unique=Array.from(new Map(sources.filter(s=>safeHTTP(s.url)).map(s=>[s.url,s])).values());
 const hits:SearchHit[]=unique.slice(0,10).map(s=>({id:'web:'+s.url,kind:'page',title:s.title.slice(0,250),description:(s.snippet||'Найдена страница по запросу. Цену, адрес и наличие проверьте у продавца.').replace(/<[^>]*>/g,'').slice(0,600),category:'',city,address:null,point:null,phone:null,site:s.url,hours:null,source:s.url,checkedAt:new Date().toISOString(),price:null,image:null,status:'website',distanceKm:null}));
 // Store only links and short provenance, never a generated answer as inventory.
 await cacheWrite(key,hits,3600000);return hits;
 }};}
