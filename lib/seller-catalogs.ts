import {fetchSource} from './source-fetch';
import {extractOffers,pageHit} from './offer-extraction';
import {relevantOffers} from './offer-relevance';
import {cacheRead,cacheWrite,acquireProvider,releaseProvider} from './search-storage';
import {cacheHit} from './search-usage';
import {recordFreeCall} from './api-budget';
import type {SearchHit} from './city-search';
// Reviewed catalog URLs, NOT fabricated inventory. Every offer is fetched and parsed.
// Regional catalogs can include delivery-only sellers; never infer a physical branch.
const catalogs=[
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
];
export async function catalogOffers(query:string,city:string):Promise<SearchHit[]>{
 if(!/^казань$/iu.test(city.trim()))return []; // Never label a regional offer as a different city.
 const sources=catalogs.filter(c=>c.matches.test(query)).slice(0,2);
 const batches=await Promise.all(sources.map(async({url})=>{
  const key='seller-catalog:v8:'+city.trim().toLowerCase()+':'+url,cached=await cacheRead<SearchHit[]>(key);
  if(cached){cacheHit();return cached;}
  const lock='seller:'+new URL(url).hostname;if(!await acquireProvider(lock,20000))return [];
  const start=performance.now();let success=false;
  try{const html=await fetchSource(url);const offers=html?extractOffers(html,url,city):[];success=!!html;
   const observed=offers.length?offers.map(h=>({...h,city,locationEvidence:'regional-catalog' as const})):[pageHit(url,'Каталог продавца — уточнить цену',city)];
   await cacheWrite(key,observed,offers.length?1800000:120000);return observed;
  }finally{await releaseProvider(lock,1500);await recordFreeCall('seller-catalog',performance.now()-start,success?'complete':'unavailable');}
 }));
 return relevantOffers(batches.flat(),query,city);
}
