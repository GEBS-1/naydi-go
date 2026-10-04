import {searchChargeable} from './search-completion';
import {queryCity} from './query-city';
import {withUsage,currentUsage} from './search-usage';
import {cleanCity,cityKey} from './location';
import {dialogContext} from './dialog-context';
import {matchSellerLocations} from './merchant-match';
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
export type SearchRequest={resume?:boolean;query:string;city:string;near?:GeoPoint;bounds?:Bounds;context?:SearchContext};
export type SearchResponse={chargeable?:boolean;hits:SearchHit[];results:SearchResult[];context:SearchContext;intent:Intent;phase:'local'|'complete';sources:{osm:string;web:string};timing:{parseMs:number;localMs:number;externalMs:number;totalMs:number};warnings:string[];usage?:ReturnType<typeof currentUsage>};
function relevanceScore(hit:SearchHit,query:string){
 const hay=normalize(`${hit.title} ${hit.category} ${hit.description}`),q=normalize(query);
 let score=hit.kind==='product'?120:0;
 const groups:[RegExp,string[]][]=[
  [/свечн[а-яё]*\s+(?:ключ|головк)|(?:ключ|головк)[а-яё]*\s+(?:для\s+)?свеч/u,['инструмент','крепеж','крепёж','hardware','doityourself','trade','автоинструмент']],
  [/дрел|перфорат|шурупов|инструмент|креп[её]ж/u,['инструмент','крепеж','крепёж','hardware','doityourself','trade','строй','хозтовар']],
  [/авто|машин|аккумулятор|компрессор|toyota|rav4/u,['авто','запчаст','car parts','tyres','шин','аккумулятор']],
  [/корм|кош|кот|собак|зоотовар/u,['зоо','pet','вет','корм']],
  [/наушник|телефон|ноутбук|электрон/u,['электрон','electronics','computer','mobile phone','цифров']],
  [/велосипед|спорт|мяч/u,['велосипед','bicycle','спорт','sports']],
  [/цвет|букет/u,['цвет','florist']],
  [/сад|дач|семен|растени/u,['сад','garden','agrarian','семен']],
  [/ламп|свет/u,['ламп','свет','lighting']],
 ];
 const terms=groups.find(([pattern])=>pattern.test(q))?.[1]||[];
 for(const term of terms)if(hay.includes(normalize(term)))score+=18;
 const tokens=q.split(' ').filter(token=>token.length>3&&!['найди','купить','казани','москве','самаре','рядом'].includes(token));
 for(const token of tokens)if(hay.includes(token.slice(0,Math.max(4,token.length-2))))score+=8;
 if(hit.point&&hit.address)score+=3;if(hit.site)score+=2;if(hit.phone)score+=1;
 return score;
}
export async function runSearch(input:SearchRequest,emit?:(r:SearchResponse)=>void):Promise<SearchResponse>{const explicit=await queryCity(input.query);if(explicit)input={...input,query:explicit.query,city:explicit.city,near:undefined,context:undefined};const city=cleanCity(input.city);if(city.length<2)throw Error('Выберите город для поиска.');return withUsage(()=>runSearchMeasured({...input,city},emit));}
async function runSearchMeasured(input:SearchRequest,emit?:(r:SearchResponse)=>void):Promise<SearchResponse>{
 const started=performance.now(),dialog=input.resume&&input.context?{context:input.context,question:undefined}:await dialogContext(input.query,input.context),context=dialog.context,intent=parseIntent(context.query,input.city),parseMs=performance.now()-started;
 const constrain=(list:SearchHit[])=>list.filter(h=>(context.maxPrice===undefined||h.price===null||h.price<=context.maxPrice)&&(context.radiusKm===undefined||h.distanceKm===null||h.distanceKm<=context.radiusKm)).sort((a,b)=>context.sort==='price-distance'?((a.price??Infinity)-(b.price??Infinity)||((a.distanceKm??Infinity)-(b.distanceKm??Infinity))):context.sort==='price'?(a.price??Infinity)-(b.price??Infinity):relevanceScore(b,intent.query)-relevanceScore(a,intent.query)||((a.distanceKm??Infinity)-(b.distanceKm??Infinity)));
 const present=(r:SearchResponse)=>{r.usage=currentUsage();r.hits=constrain(r.hits.filter(h=>input.bounds||!h.city||cityKey(h.city)===cityKey(input.city)));r.results=r.hits.map(toSearchResult).filter((h):h is SearchResult=>h!==null);return r;};
 const index=await publicIndex(),local=localDiscovery(index.products,index.shops,intent.query,input.city,input.near);
 const hits:SearchHit[]=local.offers.map(o=>({id:o.id,kind:o.kind,title:o.product.name,description:o.product.features||o.product.description,category:o.product.category,city:o.shop.city,address:o.address,point:o.shop.addressConfirmed?{lat:o.shop.lat,lng:o.shop.lng}:null,phone:o.shop.phone||null,site:o.shop.site||null,hours:o.shop.hours||null,source:o.source,checkedAt:o.checkedAt||'',price:o.product.price,image:o.product.photos[0]||null,status:o.confirmed?'seller-confirmed':'website',distanceKm:o.distanceKm,product:o.product,shop:o.shop}));
 for(const s of local.stores.filter(s=>!local.offers.some(o=>o.shop.id===s.id)))hits.push({id:s.id,kind:'store',title:s.name,description:s.description,category:s.category,city:s.city,address:s.street,point:s.addressConfirmed?{lat:s.lat,lng:s.lng}:null,phone:s.phone||null,site:s.site||null,hours:s.hours||null,source:s.source||'/#store/'+s.id,checkedAt:'',price:null,image:s.photos[0]||null,status:'organization',distanceKm:null,shop:s});
 if(intent.query){const rows=await db().prepare('SELECT data FROM external_places WHERE city=? AND (?="" OR category=?) AND checked_at>? LIMIT 300').bind(normalize(input.city),intent.category,intent.category,Date.now()-7*86400000).all<{data:string}>();for(const r of rows.results){const h=JSON.parse(r.data) as SearchHit;if(normalize(h.city)===normalize(input.city)&&(intent.category||normalize(h.title).includes(normalize(intent.query))))hits.push(h);}}
 let result:SearchResponse={results:[],context,hits:deduplicate(await hidePrivate(hits),input.near),intent,phase:'local',sources:{osm:'pending',web:'pending'},timing:{parseMs,localMs:performance.now()-started,externalMs:0,totalMs:performance.now()-started},warnings:dialog.question?[dialog.question]:[]};
 present(result);emit?.(result);
 if(intent.clarification.length||!intent.query){result={...result,phase:'complete',sources:{osm:'skipped',web:'skipped'}};emit?.(result);return result;}
 const webQuery=context.maxPrice===undefined?intent.query:intent.query.replace(/(?:до|не дороже|бюджет)\s*\d[\d\s]*(?:[,.]\d{1,2})?\s*(?:тыс(?:яч)?\.?|руб(?:лей)?|₽)?/giu,'').trim()+` до ${context.maxPrice} рублей`;
 const ext=performance.now();const webTask=intent.kind==='service'?Promise.resolve({hits:[] as SearchHit[],status:'osm-services'}):result.hits.some(h=>h.kind==='product'&&h.checkedAt&&Date.now()-Date.parse(h.checkedAt)<3600000)?Promise.resolve({hits:[] as SearchHit[],status:'index-sufficient'}):searchWeb(webQuery,input.city);const [osm,web]=await Promise.all([findOrganizations(intent,input.city,input.bounds).catch(()=>({hits:[] as SearchHit[],status:'unavailable'})),webTask]);
 const organizations=await hidePrivate(osm.hits);
 if(organizations.length)await db().batch(organizations.map(h=>db().prepare('INSERT INTO external_places(id,city,category,data,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET city=excluded.city,category=excluded.category,data=excluded.data,checked_at=excluded.checked_at').bind(h.id,normalize(h.city),intent.category,JSON.stringify(h),new Date(h.checkedAt).getTime())));
 // API web snippets are not persisted unless the provider contract grants storage rights.
 result={...result,hits:deduplicate(await hidePrivate([...organizations,...result.hits,...matchSellerLocations(web.hits,[...organizations,...result.hits])]),input.near),phase:'complete',sources:{osm:osm.status,web:web.status},timing:{...result.timing,externalMs:performance.now()-ext,totalMs:performance.now()-started},warnings:[]};
 if(['unavailable','busy','cooldown'].includes(osm.status))result.warnings.push('Поиск организаций временно недоступен или занят. Сохранённые результаты остаются в выдаче.');
 if(web.status==='not-configured')result.warnings.push('Полный веб-поиск не подключён. Показываем нашу базу, организации OpenStreetMap и указанные ими сайты. Конкретные товары и остатки уточняйте.');
 if(web.status==='unavailable')result.warnings.push('Веб-поиск: '+('error' in web?web.error:'временно недоступен'));
 if(dialog.question)result.warnings.push(dialog.question);
 if(context.maxPrice!==undefined)result.warnings.push(`Бюджет до ${context.maxPrice} ₽: предложения без цены и организации показаны отдельно; соответствие бюджету не подтверждено.`);
 if(context.newOnly)result.warnings.push('У источников нет подтверждённого состояния товара. Условие «только новые» требует проверки у продавца.');
 if(context.sort==='price-distance'&&!input.near)result.warnings.push('Чтобы показать ближе, укажите адрес или разрешите геолокацию. Без координат сортируем только известные цены.');
 if(context.radiusKm&&!input.near)result.warnings.push('Для ограничения радиуса укажите начальный адрес или разрешите геолокацию.');
 present(result);
 const localResults=result.hits.filter(h=>h.kind!=='page'&&h.locationEvidence!=='unverified');
 if(!localResults.length&&result.hits.some(h=>h.kind==='page'||h.locationEvidence==='unverified'))result.warnings.unshift(`В ${input.city} не удалось подтвердить местный магазин для найденных интернет-страниц. Они вынесены во вкладку «Сайты» и не показаны как предложения рядом.`);
 result.chargeable=searchChargeable(result.hits.length,result.sources);
 if(!result.chargeable)result.warnings.push('Источники не ответили, подходящих результатов в индексе нет. Поиск не списан из вашего лимита.');
 if(context.maxPrice!==undefined&&!result.hits.some(h=>h.kind==='product'&&h.price!==null))result.warnings.unshift(`Не нашли подтверждённых предложений с опубликованной ценой до ${context.maxPrice} ₽. Ниже — источники и магазины, где можно уточнить цену.`);
 const budget=await budgetState();if(budget.warning)result.warnings.push(`Использовано или зарезервировано ${budget.warning}% месячного бюджета API. ${budget.warning===100?'Платный поиск остановлен.':''}`);
 await db().batch([db().prepare('INSERT INTO searches(id,query,result_count,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),input.query,result.hits.length,new Date().toISOString()),db().prepare('INSERT INTO search_metrics(id,data,created_at) VALUES(?,?,?)').bind(crypto.randomUUID(),JSON.stringify({city:input.city,category:intent.category,timing:result.timing,sources:result.sources,count:result.hits.length,usage:currentUsage()}),Date.now())]);
 emit?.(result);return result;
}
