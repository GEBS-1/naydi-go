import {normalize} from './search';
import {km} from './discovery';
import {journeyIntent} from './journey-intent';
import type {Product,Shop} from './model';
export type GeoPoint={lat:number;lng:number};
export type ProductFacts={model?:string;brand?:string;characteristics?:{name:string;value:string}[];rating?:{value:number;best:number;count:number|null}};
export type SearchHit=ProductFacts&{detailsKey?:string;id:string;kind:'product'|'service'|'store'|'page';title:string;description:string;category:string;city:string;address:string|null;point:GeoPoint|null;phone:string|null;site:string|null;hours:string|null;source:string;checkedAt:string;price:number|null;image:string|null;status:'seller-confirmed'|'website'|'organization';distanceKm:number|null;product?:Product;shop?:Shop;locationSource?:string;locationEvidence?:'confirmed-point'|'regional-catalog'|'unverified';sellerLocationGroupComplete?:boolean;sellerLocations?:{address:string;point:GeoPoint;phone?:string;hours?:string;source?:string}[];sourceAvailability?:'in_stock'|'out_of_stock'|'preorder'|'unknown';seller?:string;sellerLinks?:string[];currency?:'RUB'|null;priceEvidence?:string|null;evidence?:'source-page'|'search-index';advertisement?:false};
export type PublicSearchHit=Omit<SearchHit,'category'|'product'|'sellerLinks'>&{
 product?:Pick<Product,'id'|'condition'|'priceMode'>;
};
type MappableHit=Omit<SearchHit,'product'|'category'>&{category?:string};
export type Intent={query:string;kind:'product'|'service'|'store'|'complex';journey:boolean;nearby:boolean;category:string;selectors:string[];clarification:string[]};
const services:[RegExp,string,string[]][]=[
 [/обув.*ремонт|ремонт.*обув|сапожник/iu,'Ремонт обуви',['["craft"="shoemaker"]','["shop"="shoe_repair"]']],
 [/ремонт.*(?:телефон|смартфон|планшет)|(?:починить|починка).*(?:телефон|смартфон|планшет)/iu,'Ремонт телефонов',['["craft"="electronics_repair"]']],
 [/веломастерск|велосервис|(?:ремонт|почин\S*).*велосипед/iu,'Ремонт велосипедов',['["service:bicycle:repair"="yes"]','["craft"="bicycle_repair"]']],
 [/замен[а-я]*\s+масл|автосервис|ремонт.*(?:авто|машин)|шиномонтаж/iu,'Автосервис',['["shop"="car_repair"]','["craft"="car_repair"]']],
 [/маникюр|педикюр|ногтев/iu,'Маникюр',['["shop"="beauty"]["beauty"~"nails"]']],
 [/химчист|сухая чистка/iu,'Химчистка',['["shop"="dry_cleaning"]']],
 [/парикмах|стрижк|подстрич|барбершоп|barber/iu,'Парикмахерские',['["shop"="hairdresser"]']],
 [/изготовлен.*ключ|дубликат.*ключ|ключ.*дубликат/iu,'Изготовление ключей',['["craft"="key_cutter"]','["shop"="locksmith"]']],
];

export function matchesServicePlace(hit:SearchHit,intent:Intent){
 if(hit.kind==='product'||hit.kind==='page')return false;
 const tag=normalize(hit.category);
 const tags=intent.selectors.flatMap(selector=>selector.match(/^\["[^"]+"="([^"]+)"\]$/u)?.[1]||[]);
 if(hit.id.startsWith('osm:')&&tags.some(value=>normalize(value)===tag))return true;
 const rule=services.find(([,name])=>name===intent.category);
 const text=`${hit.title} ${hit.site||''}`;
 return rule?rule[0].test(text):normalize(text).includes(normalize(intent.query));
}

/** An OSM shop is a possible category seller only when its actual tag matches
 * the taxonomy selected for the query. Neither tag nor name proves stock. */
export function matchesProductPlace(hit:Pick<SearchHit,'id'|'category'>,intent:Intent){
 if(!hit.id?.startsWith('osm:')||intent.kind!=='product'||!intent.selectors.length)return true;
 const allowed=intent.selectors.flatMap(selector=>selector.match(/^\["[^"]+"="([^"]+)"\]/u)?.[1]||[]).map(normalize);
 return !allowed.length||allowed.includes(normalize(hit.category));
}

// These are mappings to OSM's real taxonomy, not inventories or canned results.
const taxonomy:[RegExp,string,string[]][]=[
 [/раскраск|книжк[аиу]|книг[аиу]|канцеляр/iu,'Книги и канцтовары',['["shop"="books"]','["shop"="stationery"]','["shop"="toys"]']],
 [/подарок|игрушк/iu,'Подарки',['["shop"="gift"]','["shop"="toys"]']],
 [/обув.*ремонт|ремонт.*обув/iu,'Ремонт обуви',['["craft"="shoemaker"]']],
 [/свечн[а-яё]*\s+(?:ключ|головк)|(?:ключ|головк)[а-яё]*\s+(?:для\s+)?свеч/iu,'Автоинструмент',['["shop"="car_parts"]','["shop"="hardware"]']],
 [/автомобильн.*компрессор|компрессор.*(?:шин|колес)|автонасос/iu,'Автотовары',['["shop"="car_parts"]','["shop"="tyres"]']],
 [/гаечн|набор.*ключ|ключ.*(?:рожков|накидн|торцев|комбинирован)|трещотк|головк.*торцев/iu,'Инструменты',['["shop"="hardware"]','["shop"="doityourself"]','["shop"="trade"]','["shop"="car_parts"]']],
 [/авто(?:мобильн)?.*краск|краск.*авто|автоэмал|эмал.*авто/iu,'Автотовары',['["shop"="car_parts"]','["shop"="paint"]']],
 [/(?:^|[^а-яё])краск[а-яё]*|лакокрас|эмал/iu,'Краски',['["shop"="paint"]','["shop"="doityourself"]','["shop"="hardware"]']],
 [/ключ|замк|дубликат/iu,'Изготовление ключей',['["craft"="key_cutter"]','["shop"="locksmith"]','["craft"="locksmith"]']],
 [/автозапчаст|аккумулятор|toyota|rav4|автотовар|моторн.*масл/iu,'Автотовары',['["shop"="car_parts"]']],
 [/корм|зоотовар|собак|кошк/iu,'Зоотовары',['["shop"="pet"]']],
 [/бров|тональн|помад|тушь|туши/iu,'Косметика',['["shop"="cosmetics"]']],
 [/ручк[аиу]?\s+шариков|шариков[а-яё]*\s+ручк|стерж[её]н[а-яё]*\s+(?:для\s+)?ручк|шариков[а-яё]*\s+стерж[её]н|карандаш|тетрад|канцтовар/iu,'Канцтовары',['["shop"="stationery"]','["shop"="books"]']],
 [/чайник|утюг|пылесос|кофевар/iu,'Бытовая техника',['["shop"="electronics"]','["shop"="houseware"]']],
 [/настольн.*ламп|ламп.*(?:чтени|стол)|светильник/iu,'Освещение',['["shop"="lighting"]','["shop"="houseware"]','["shop"="doityourself"]']],
 [/ламп|светодиодн.*(?:e27|e14)/iu,'Освещение',['["shop"="lighting"]','["shop"="electrical"]','["shop"="doityourself"]']],
 [/ванн|сантех|ремонт|строймат|лампоч|инструмент|перфорат|дрел|шурупов[её]рт|креп[её]ж/iu,'Дом и ремонт',['["shop"="doityourself"]','["shop"="hardware"]','["shop"="bathroom_furnishing"]','["shop"="trade"]']],
 [/спорт|велосипед|мяч|хобби/iu,'Спорт и хобби',['["shop"="sports"]','["shop"="bicycle"]']],
 [/электрон|ноутбук|телефон|наушник/iu,'Электроника',['["shop"="electronics"]','["shop"="computer"]','["shop"="mobile_phone"]']],
 [/космет|парфюм|макияж|красот/iu,'Красота и здоровье',['["shop"="cosmetics"]','["shop"="beauty"]','["shop"="chemist"]']],
 [/продукт|мяс|колбас|сыр|молок|фермер/iu,'Продукты',['["shop"="deli"]','["shop"="butcher"]','["shop"="farm"]','["shop"="convenience"]']],
 [/сад|дач|семен|растени/iu,'Сад и дача',['["shop"="garden_centre"]','["shop"="agrarian"]']],
 [/обув.*ремонт|ремонт.*обув/iu,'Ремонт обуви',['["craft"="shoemaker"]']],
 [/парикмах|стрижк/iu,'Парикмахерские',['["shop"="hairdresser"]']],
 [/кружк|керамическ.*(?:посуд|чашк)|посуд/iu,'Посуда',['["shop"="houseware"]','["shop"="pottery"]','["craft"="pottery"]']],
 [/термос|термокружк|контейнер.*(?:для\s+)?еды/iu,'Посуда',['["shop"="houseware"]','["shop"="department_store"]','["shop"="outdoor"]']],
 [/куртк|пуховик|пальто|дубл[её]нк|шуб[а-яё]*|одежд|джинс|брюк|рубашк|свитер|толстовк|ветровк/iu,'Одежда',['["shop"="clothes"]','["shop"="department_store"]']],
 [/цвет/iu,'Цветы',['["shop"="florist"]']],
 [/кружк|посуд|тарелк|чашк/iu,'Посуда',['["shop"="houseware"]','["shop"="department_store"]']],
 ];
export function parseIntent(raw:string,city:string):Intent{
 const journey=/по\s+(дороге|пути)|еду\s+(из|в)|в сторону/iu.test(raw)||journeyIntent(raw).routeOnly,nearby=/рядом|ближайш/iu.test(raw);
 const clean=raw.replace(/\s+по\s+(дороге|пути)[\s\S]*$/iu,'').replace(/\s+рядом(?:\s+со\s+мной)?/giu,'').replace(/^(купить|найти|где|нужно|хочу)\s+/iu,'').trim();
 const cityRoot=normalize(city).replace(/[аяьй]$/u,'');
 const query=clean.split(/\s+/).filter(w=>!['в','во'].includes(w.toLowerCase())&&!(cityRoot.length>3&&normalize(w).startsWith(cityRoot))).join(' ')||clean;
 const asksToBuy=/^(?:где\s+)?(?:купить|заказать товар)(?:\s|$)/iu.test(raw.trim());
 const service=asksToBuy?undefined:services.find(([pattern])=>pattern.test(query));
 const hit=service||taxonomy.find(([re])=>re.test(query));
 const complex=/(вс[её]\s+для|обустро|список\s+покуп|закупк)/iu.test(raw);
 const kind=complex?'complex':service||!asksToBuy&&/(сделать|изготовлен|дубликат|мастерск|почин|стрижк|ремонт.*обув)/iu.test(raw)?'service':/^(?:магазин|организац)/iu.test(query)?'store':'product';
 const clarification=/^ключи?$/iu.test(query)?['Изготовление ключей','Автомобильные ключи','Гаечные ключи']:/подарок.*(?:реб[её]нк|девочк|мальчик)/iu.test(query)&&!/(?:лет|год|мес)/iu.test(query)?[3,7,12].map(age=>query+' для возраста '+age+' лет'):[];
 return {query,kind,journey,nearby,category:hit?.[1]||'',selectors:hit?.[2]||[],clarification};
}
export function safeHTTP(value:unknown){if(typeof value!=='string')return null;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function canonical(value:string){return normalize(value).replace(/\s/g,'');}
export function genericListing(h:SearchHit){return (h.kind==='product'||h.kind==='store')&&h.status!=='seller-confirmed'&&(/(?:купить по низким|купить по выгодным|купить по доступным|купить от\s*\d|большой выбор|широкий ассортимент|каталог товаров|все товары|цены от)/iu.test(h.title)||/\/(?:tag-page|catalog|category)\//iu.test(h.source));}
export function deduplicate(hits:SearchHit[],near?:GeoPoint){const map=new Map<string,SearchHit>();for(const original of hits){const h=genericListing(original)?{...original,kind:'page' as const,price:null,address:null,point:null,locationEvidence:'unverified' as const}:original;const key=h.kind==='product'?(h.site||h.source)+'|'+canonical(h.title):h.kind==='page'?h.source:canonical(h.title)+'|'+normalize(h.city)+'|'+(h.address?canonical(h.address):h.point?`${h.point.lat.toFixed(4)},${h.point.lng.toFixed(4)}`:h.id),existing=map.get(key);if(!existing){map.set(key,{...h,distanceKm:near&&h.point?km(near,h.point):null});continue;}map.set(key,{...existing,address:existing.address||h.address,point:existing.point||h.point,phone:existing.phone||h.phone,site:existing.site||h.site,image:existing.image||h.image,model:existing.model||h.model,brand:existing.brand||h.brand,characteristics:existing.characteristics?.length?existing.characteristics:h.characteristics,rating:existing.rating||h.rating,hours:existing.hours||h.hours,locationEvidence:existing.locationEvidence==='confirmed-point'||h.locationEvidence==='confirmed-point'?'confirmed-point':existing.locationEvidence||h.locationEvidence,locationSource:existing.locationSource||h.locationSource,shop:existing.shop||h.shop,distanceKm:near&& (existing.point||h.point)?km(near,(existing.point||h.point)!):existing.distanceKm});}return [...map.values()].sort((a,b)=>(a.kind==='product'?0:1)-(b.kind==='product'?0:1)||(a.distanceKm??Infinity)-(b.distanceKm??Infinity));}
export function hasConfirmedLocation(h:MappableHit){return h.kind!=='page'&&!!h.address?.trim()&&!!h.point&&Number.isFinite(h.point.lat)&&Number.isFinite(h.point.lng)&&Math.abs(h.point.lat)<=85&&Math.abs(h.point.lng)<=180&&(h.locationEvidence==='confirmed-point'||h.shop?.addressConfirmed===true);}
export function routeHit(h:MappableHit,from?:GeoPoint){return hasConfirmedLocation(h)&&h.point?'https://yandex.ru/maps/?'+new URLSearchParams({rtext:`${from?`${from.lat},${from.lng}`:''}~${h.point.lat},${h.point.lng}`,rtt:'auto'}):null;}
function hostName(url:string|null|undefined){try{return new URL(url||'').hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
export function hitShop(h:MappableHit):Shop{
 if(h.shop)return h.shop;
 const locationUrl=h.locationSource||h.site||h.source,seller=h.seller?.trim()||hostName(locationUrl)||h.title;
 const locationId=h.kind==='store'||h.status==='organization'?h.id:`source-location:${normalize(hostName(locationUrl)||seller)}:${h.point?`${h.point.lat.toFixed(5)},${h.point.lng.toFixed(5)}`:normalize(h.address||'')}`;
 return {id:locationId,name:h.kind==='store'||h.status==='organization'?h.title:seller,description:h.kind==='store'||h.status==='organization'?h.description:'',category:h.category||'',city:h.city,street:h.address||'',lat:h.point?.lat??0,lng:h.point?.lng??0,phone:h.phone||'',site:h.site||locationUrl||'',hours:h.hours||'',photos:(h.kind==='store'||h.status==='organization')&&h.image?[h.image]:[],contact:'',email:'',source:locationUrl||h.source,status:'reference',demo:false,addressConfirmed:!!h.point&&!!h.address&&h.locationEvidence==='confirmed-point',visibility:'public'};
}
export function mapHitShop(h:MappableHit,candidates:MappableHit[]):Shop{
 if(h.kind==='product'&&(h.shop?.addressConfirmed===true||h.point&&h.address&&h.locationEvidence==='confirmed-point')&&h.sellerLocationGroupComplete!==false){
  const host=hostName(h.shop?.site||h.site||h.source),point=h.point||(h.shop?.addressConfirmed?{lat:h.shop.lat,lng:h.shop.lng}:undefined);
  const seller=candidates.find(candidate=>{
   if(candidate.kind!=='store'||candidate.status!=='organization'||candidate.locationEvidence!=='confirmed-point'||candidate.sellerLocationGroupComplete===false||candidate.city!==h.city||!candidate.point||!candidate.address)return false;
   const candidateHost=hostName(candidate.site||candidate.shop?.site||candidate.source),sameHost=!!host&&!!candidateHost&&(candidateHost===host||candidateHost.endsWith('.'+host)||host.endsWith('.'+candidateHost));
   if(h.shop&&candidate.shop?.id===h.shop.id)return true;
   const sameSource=!!h.locationSource&&(h.locationSource===candidate.source||h.locationSource===candidate.locationSource);
   return (sameSource||sameHost)&&!!point&&km(point,candidate.point)<=0.03;
  });
  if(seller)return hitShop(seller);
 }
 if(h.shop)return h.shop;
 return hitShop(h);
}
