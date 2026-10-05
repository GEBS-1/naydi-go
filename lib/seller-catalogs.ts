import {fetchSource} from './source-fetch';
import {extractOffers,pageHit} from './offer-extraction';
import {relevantOffers} from './offer-relevance';
import {cacheRead,cacheReadEntry,cacheWrite,acquireProvider,releaseProvider} from './search-storage';
import {cacheHit} from './search-usage';
import {recordFreeCall} from './api-budget';
import type {SearchHit} from './city-search';
// Reviewed catalog URLs, NOT fabricated inventory. Every offer is fetched and parsed.
// Regional catalogs can include delivery-only sellers; never infer a physical branch.
type Catalog={matches:RegExp;url:string;location?:{address:string;point:{lat:number;lng:number};phone:string;source:string}};
const catalogs:Catalog[]=[
 {matches:/свечн[а-яё]*\s+(?:ключ|головк)|(?:ключ|головк)[а-яё]*\s+(?:для\s+)?свеч/iu,url:'https://kazan.tatmetiz.ru/shop/car-accessories/kluch-svechnoi/'},
 {matches:/дрел|шурупов[её]рт/iu,url:'https://kazan.tatmetiz.ru/shop/instrument/elektroinstrument/elektroinstrument-akkumulyatornye-shurupoverty/'},
 {matches:/сверл|бур(?:ы|ов|ом)?/iu,url:'https://kazan.novocraft.ru/catalog/svyerla_novocraft/sverla_po_betonu_kamnyu_kirpichu_masonry/'},
 {matches:/креп[её]ж|дюбел|анкер|метиз|саморез|болт/iu,url:'https://megakrepezh.ru/krepezh/perforaciya'},
 {matches:/инструмент|оснастк|патрон.*дрел|переходник.*sds/iu,url:'https://skskazan.ru/catalog/aksessuary-dlya-elektroinstrumentov/'},
 {matches:/^дом и ремонт$|ремонт|строймат/iu,url:'https://megakrepezh.ru/krepezh/perforaciya'},
 {matches:/^дом и ремонт$|инструмент/iu,url:'https://kazan.tatmetiz.ru/shop/instrument/elektroinstrument/elektroinstrument-akkumulyatornye-shurupoverty/'},
 {matches:/автозапчаст|запчаст.*(?:иномарк|geely|tugella)|^авто(?:товары)?$/iu,url:'https://autocraft-kzn.ru/geely/tugella/dvigatel'},
 {matches:/автозапчаст|запчаст.*(?:газ|газел|уаз|паз)|^авто(?:товары)?$/iu,url:'https://gazzap116.ru/catalog/gazel/'},
 {matches:/корм|зоотовар|кош|кот|собак|щен/iu,url:'https://makpets.ru/'},
 {matches:/корм.*(?:кош|кот)|(?:кош|кот).*корм|^зоотовары$/iu,url:'https://kazan.gomeovet.ru/catalog1/tovari-dla-koshek/korm-dla-koshek/'},
 {matches:/корм.*(?:собак|пес|щен)|(?:собак|пес|щен).*корм|^зоотовары$/iu,url:'https://kazan.gomeovet.ru/catalog1/dog/korma_dla_sobak/'},
 {matches:/наушник|гарнитур/iu,url:'https://kazan-mall.istudio-kazan.ru/catalog/akustika/headphones_headsets/'},
 {matches:/^электроника$|электронн(?:ая|ые)\s+(?:техника|товары)/iu,url:'https://kazan-mall.istudio-kazan.ru/catalog/akustika/headphones_headsets/'},
 {matches:/велосипед|^спорт и хобби$/iu,url:'https://velosky.ru/catalog/kupit_velosipedy_v_kazani/'},
 {matches:/лампоч|ламп[ауы]|ламп светодиод/iu,url:'https://kazan.poryadok.ru/catalog/lampy_svetodiodnye/'},
 {matches:/космет|туш|крем|сыворот|маск[аи]|макияж|^красота и здоровье$/iu,url:'https://maikorcos.com/'},
 {matches:/корейск.*космет|тканев.*маск/iu,url:'https://koreavisage.ru/'},
 {matches:/^сад и дача$|семен|рассад|сажен|растени/iu,url:'https://www.biosfera-kazan.ru/'},
 {matches:/алмазн.*(?:коронк|диск)|виброплит|шлифмаш|малярн.*инструмент|строительн.*оборудован/iu,url:'https://fenixkz.ru/internet-magazin/folder/almaznaya-osnastka',location:{address:'ул. Бухарская, 3А, Казань',point:{lat:55.7742329,lng:49.2011595},phone:'+7 843 226-96-09',source:'https://fenixkz.ru/'}},
 {matches:/зоотовар|когтерез|пуходерк|ошейник|шлейк|поводок|груминг|товар.*животн/iu,url:'https://rybalka-rt.ru/catalog/zootovary/',location:{address:'ул. Восстания, 8, Казань',point:{lat:55.8360194,lng:49.0986157},phone:'+7 987 225-15-15',source:'https://rybalka-rt.ru/'}},
 {matches:/автозвук|автомагнитол|сабвуфер|автосигнализац|видеорегистратор|динамик.*авто/iu,url:'https://signalka16.ru/',location:{address:'ул. Фатыха Амирхана, 48, Казань',point:{lat:55.8434885,lng:49.1374226},phone:'+7 843 266-50-54',source:'https://signalka16.ru/'}},
];
function matchingCatalogs(query:string){return catalogs.filter(c=>c.matches.test(query)).slice(0,2);}
function cacheKey(city:string,url:string){return 'seller-catalog:v8:'+city.trim().toLowerCase()+':'+url;}
/** Read the last observed seller offers without waiting for network refresh. */
export async function cachedCatalogOffers(query:string,city:string):Promise<{hits:SearchHit[];fresh:boolean}>{
 if(!/^казань$/iu.test(city.trim()))return {hits:[],fresh:true};
 const entries=await Promise.all(matchingCatalogs(query).map(({url})=>cacheReadEntry<SearchHit[]>(cacheKey(city,url))));
 const present=entries.filter((entry):entry is NonNullable<typeof entry>=>entry!==null);
 if(present.length)cacheHit();
 return {hits:relevantOffers(present.flatMap(entry=>entry.data),query,city),fresh:present.length>0&&present.every(entry=>entry.fresh)};
}
export async function catalogOffers(query:string,city:string):Promise<SearchHit[]>{
 if(!/^казань$/iu.test(city.trim()))return []; // Never label a regional offer as a different city.
 const sources=matchingCatalogs(query);
 const batches=await Promise.all(sources.map(async({url,location})=>{
  const key=cacheKey(city,url),cached=await cacheRead<SearchHit[]>(key);
  if(cached){cacheHit();return cached;}
  const lock='seller:'+new URL(url).hostname;if(!await acquireProvider(lock,20000))return [];
  const start=performance.now();let success=false;
  try{const html=await fetchSource(url);const offers=html?extractOffers(html,url,city):[];success=!!html;
   const observed=offers.length?offers.map(h=>location&&h.kind==='product'?{...h,city,address:location.address,point:location.point,phone:location.phone,locationSource:location.source,locationEvidence:'confirmed-point' as const,description:(h.description?`${h.description} `:'')+'Адрес продавца подтверждён; наличие этого товара в точке уточняйте.'}:{...h,city,locationEvidence:'regional-catalog' as const}):[pageHit(url,'Каталог продавца — уточнить цену',city)];
   await cacheWrite(key,observed,offers.length?1800000:120000);return observed;
  }finally{await releaseProvider(lock,1500);await recordFreeCall('seller-catalog',performance.now()-start,success?'complete':'unavailable');}
 }));
 return relevantOffers(batches.flat(),query,city);
}
