import {jsonLD} from './offer-extraction';
import {safeHTTP,type SearchHit} from './city-search';
import {cityKey} from './location';
import {km} from './discovery';

type RecordValue=Record<string,unknown>;
const obj=(value:unknown):RecordValue=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:{};
const text=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';

/** Only published business addresses, never Product, shipping, or model coordinates. */
export function businessLocations(html:string,source:string,city:string):SearchHit[]{
 const structured=jsonLD(html).flatMap(node=>{
  const types=[node['@type']].flat().map(text);
  if(!types.some(t=>/(?:LocalBusiness|Store|Shop|AutomotiveBusiness|AutoPartsStore|HardwareStore|HomeGoodsStore|ProfessionalService|Repair|Salon)$/iu.test(t)))return [];
  const address=obj(node.address),street=text(address.streetAddress),locality=text(address.addressLocality);
  if(!street||!locality||cityKey(locality)!==cityKey(city)||!text(node.name))return [];
  const geo=obj(node.geo),lat=Number(geo.latitude),lng=Number(geo.longitude);
  const point=geo.latitude!==undefined&&geo.longitude!==undefined&&Number.isFinite(lat)&&Math.abs(lat)<=85&&Number.isFinite(lng)&&Math.abs(lng)<=180?{lat,lng}:null;
  return [{id:'business:'+source+':'+street,kind:'store',title:text(node.name),description:'Адрес опубликован на странице организации. Наличие товара уточните у продавца.',category:'',city,address:street,point,phone:text(node.telephone)||null,site:safeHTTP(node.url)||source,sellerLinks:[node.sameAs].flat().flatMap(value=>safeHTTP(value)||[]),hours:text(node.openingHours)||null,source,checkedAt:new Date().toISOString(),price:null,image:safeHTTP(node.image)||null,status:'organization',distanceKm:null,locationSource:source,locationEvidence:point?'confirmed-point':undefined} satisfies SearchHit];
 });
 if(structured.length)return structured;
 // A product page may repeat the company's contact address in its footer.
 // That address does not identify the branch offering this particular item.
 const path=new URL(source).pathname;
 if(/\/(?:product|products|tovar|item|goods)\/[^/]+|\/(?:catalog|katalog)\/[^/]+\/[^/]+/iu.test(path))return [];
 // Many small offline shops publish contacts as ordinary text rather than schema.org.
 // Require the selected city immediately followed by a street and house number.
 const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&(?:laquo|raquo|quot);/gi,'').replace(/\s+/gu,' ');
 const escaped=city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(escaped+'\\s*[,;]\\s*((?:ул\\.?|улица|проспект|пр-т|шоссе|переулок|пер\\.?)\\s+[а-яёa-z0-9 .-]{2,65}?\\s*,\\s*(?:д(?:ом)?\\.?\\s*)?\\d+[а-яёa-z]?(?:[/-]\\d+)?(?:\\s*,?\\s*(?:корпус|корп\\.)\\s*\\d+[а-яё]?)?)','giu');
 const title=text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1])||new URL(source).hostname;
 const addresses=[...new Set([...plain.matchAll(pattern)].map(m=>m[1].trim()))].slice(0,4);
 return addresses.map(address=>({id:'business:'+source+':'+address,kind:'store',title,description:'Адрес опубликован на сайте продавца. Наличие конкретного товара уточните у продавца.',category:'',city,address,point:null,phone:plain.match(/\+7[\s(]*\d{3}[\s)]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/u)?.[0]||null,site:source,hours:null,source,checkedAt:new Date().toISOString(),price:null,image:null,status:'organization',distanceKm:null,locationSource:source}));
}

export function exactAddressMatch(place:{city?:string;label:string},city:string,address:string){
 const norm=(s:string)=>s.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/(?:улица|ул\.|проспект|просп\.|пр-т|дом|д\.)\s*/gu,'').replace(/корпус|корп\./gu,'к').replace(/к\s+(\d)/gu,'к$1').replace(/[^а-яa-z0-9]+/gu,' ').trim();
 const baseAddress=norm(address).replace(/\s+к\d+[а-я]?$/u,'');
 const house=[...baseAddress.matchAll(/(?<![а-яa-z0-9])\d+[а-яa-z]?(?:\s*\d+)?(?![а-яa-z0-9])/gu)].at(-1)?.[0];
 const words=norm(address).split(' ').filter(w=>w.length>3&&!['россия',...norm(city).split(' ')].includes(w));
 const label=norm(place.label),building=norm(address).match(/(?:^|\s)к(\d+[а-я]?)(?=\s|$)/u)?.[1];
 return (!building||(` ${label} `).includes(` к${building} `))&&cityKey(place.city||'')===cityKey(city)&&!!house&&(` ${label} `).includes(` ${house} `)&&words.length>0&&words.every(w=>label.includes(w));
}

type AddressPlace={city?:string;label:string;lat:number;lng:number;extent?:number[]};
/** Photon can return both the building outline and an address node in that building. */
export function resolveExactAddress(places:AddressPlace[],city:string,address:string):AddressPlace|null{
 const exact=places.filter(p=>exactAddressMatch(p,city,address)&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=85&&Math.abs(p.lng)<=180);
 const unique=[...new Map(exact.map(p=>[p.lat.toFixed(7)+','+p.lng.toFixed(7),p])).values()];
 if(unique.length===1)return unique[0];
 if(!unique.length)return null;
 // Accept a node/outline pair only when the same exact address fits one compact building.
 // Two distinct nearby buildings remain ambiguous and never acquire a route.
 const building=unique.find(p=>{
  if(!p.extent||p.extent.length!==4||!p.extent.every(Number.isFinite))return false;
  const [west,north,east,south]=p.extent;
  if(west>=east||south>=north||km({lat:south,lng:west},{lat:north,lng:east})>0.12)return false;
  return unique.every(other=>other.lat>=south&&other.lat<=north&&other.lng>=west&&other.lng<=east);
 });
 return building||null;
}
