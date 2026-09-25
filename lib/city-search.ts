import {normalize} from './search';
import {km} from './discovery';
import type {Product,Shop} from './model';
export type GeoPoint={lat:number;lng:number};
export type SearchHit={id:string;kind:'product'|'service'|'store'|'page';title:string;description:string;category:string;city:string;address:string|null;point:GeoPoint|null;phone:string|null;site:string|null;hours:string|null;source:string;checkedAt:string;price:number|null;image:string|null;status:'seller-confirmed'|'website'|'organization';distanceKm:number|null;product?:Product;shop?:Shop;advertisement?:false};
export type Intent={query:string;kind:'product'|'service'|'store'|'complex';journey:boolean;nearby:boolean;category:string;selectors:string[];clarification:string[]};
// These are mappings to OSM's real taxonomy, not inventories or canned results.
const taxonomy:[RegExp,string,string[]][]=[
 [/подарок|игрушк/iu,'Подарки',['["shop"="gift"]','["shop"="toys"]']],
 [/обув.*ремонт|ремонт.*обув/iu,'Ремонт обуви',['["craft"="shoemaker"]']],
 [/ключ|замк|дубликат/iu,'Изготовление ключей',['["craft"="key_cutter"]','["shop"="locksmith"]','["craft"="locksmith"]']],
 [/автозапчаст|аккумулятор|toyota|rav4|автотовар|моторн.*масл/iu,'Автотовары',['["shop"="car_parts"]']],
 [/корм|зоотовар|собак|кошк/iu,'Зоотовары',['["shop"="pet"]']],
 [/ванн|сантех|ремонт|строймат|лампоч|инструмент|креп[её]ж/iu,'Дом и ремонт',['["shop"="doityourself"]','["shop"="hardware"]','["shop"="bathroom_furnishing"]','["shop"="trade"]']],
 [/спорт|велосипед|мяч|хобби/iu,'Спорт и хобби',['["shop"="sports"]','["shop"="bicycle"]']],
 [/электрон|ноутбук|телефон|наушник/iu,'Электроника',['["shop"="electronics"]','["shop"="computer"]','["shop"="mobile_phone"]']],
 [/сад|дач|семен|растени/iu,'Сад и дача',['["shop"="garden_centre"]','["shop"="agrarian"]']],
 [/обув.*ремонт|ремонт.*обув/iu,'Ремонт обуви',['["craft"="shoemaker"]']],
 [/парикмах|стрижк/iu,'Парикмахерские',['["shop"="hairdresser"]']],
 [/цвет/iu,'Цветы',['["shop"="florist"]']],
 ];
export function parseIntent(raw:string,city:string):Intent{
 const journey=/по\s+(дороге|пути)|еду\s+из/iu.test(raw),nearby=/рядом|ближайш/iu.test(raw);
 const clean=raw.replace(/\s+по\s+(дороге|пути)[\s\S]*$/iu,'').replace(/\s+рядом(?:\s+со\s+мной)?/giu,'').replace(/^(купить|найти|где|нужно|хочу)\s+/iu,'').trim();
 const cityRoot=normalize(city).replace(/[аяьй]$/u,'');
 const query=clean.split(/\s+/).filter(w=>!['в','во'].includes(w.toLowerCase())&&!(cityRoot.length>3&&normalize(w).startsWith(cityRoot))).join(' ')||clean;
 const hit=taxonomy.find(([re])=>re.test(query));
 const complex=/(вс[её]\s+для|обустро|список\s+покуп|закупк)/iu.test(raw);
 const kind=complex?'complex':/(сделать|изготовлен|дубликат|мастерск|почин|стрижк|ремонт.*обув)/iu.test(raw)?'service':/магазин|организац/iu.test(raw)?'store':'product';
 const clarification=/^ключи?$/iu.test(query)?['Изготовление ключей','Автомобильные ключи','Гаечные ключи']:/подарок.*(?:реб[её]нк|девочк|мальчик)/iu.test(query)&&!/(?:лет|год|мес)/iu.test(query)?[3,7,12].map(age=>query+' для возраста '+age+' лет'):[];
 return {query,kind,journey,nearby,category:hit?.[1]||'',selectors:hit?.[2]||[],clarification};
}
export function safeHTTP(value:unknown){if(typeof value!=='string')return null;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function canonical(value:string){return normalize(value).replace(/\s/g,'');}
export function deduplicate(hits:SearchHit[],near?:GeoPoint){const map=new Map<string,SearchHit>();for(const h of hits){const key=h.kind==='product'||h.kind==='page'?h.source:canonical(h.title)+'|'+(h.point?`${h.point.lat.toFixed(4)},${h.point.lng.toFixed(4)}`:h.address||h.id);if(!map.has(key))map.set(key,{...h,distanceKm:near&&h.point?km(near,h.point):null});}return [...map.values()].sort((a,b)=>(a.kind==='product'?0:1)-(b.kind==='product'?0:1)||(a.distanceKm??Infinity)-(b.distanceKm??Infinity));}
export function routeHit(h:SearchHit){return h.point?'https://yandex.ru/maps/?'+new URLSearchParams({rtext:`~${h.point.lat},${h.point.lng}`,rtt:'auto'}):null;}
export function hitShop(h:SearchHit):Shop{return {id:h.id,name:h.title,description:h.description,category:h.category,city:h.city,street:h.address||'',lat:h.point?.lat||0,lng:h.point?.lng||0,phone:h.phone||'',site:h.site||'',hours:h.hours||'',photos:h.image?[h.image]:[],contact:'',email:'',source:h.source,status:'reference',demo:false,addressConfirmed:!!h.point&&!!h.address,visibility:'public'};}
