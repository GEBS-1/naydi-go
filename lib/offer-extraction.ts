import {safeHTTP,type SearchHit} from './city-search';
import {microdata} from './microdata';
import {sellerOffers} from './seller-adapters';
type Json=Record<string,unknown>;
const object=(v:unknown):Json=>v&&typeof v==='object'&&!Array.isArray(v)?v as Json:{};
const type=(v:Json,t:string)=>[v['@type']].flat().some(x=>typeof x==='string'&&(x===t||x.endsWith('/'+t)));
const text=(v:unknown,max=250)=>typeof v==='string'?v.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
function productURL(value:unknown,source:string){try{return typeof value==='string'?safeHTTP(new URL(value,source).href):null;}catch{return null;}}
function productImage(value:unknown,source:string):string|null{
 const candidate=Array.isArray(value)?value[0]:value;
 const raw=typeof candidate==='string'?candidate:text(object(candidate).url||object(candidate).contentUrl,2000);
 try{const url=new URL(raw,source);return url.protocol==='https:'?url.href:null;}catch{return null;}
}
export function observedPrice(v:unknown):number|null{if(typeof v==='number')return Number.isFinite(v)&&v>=0&&v<=1e9?v:null;if(typeof v!=='string'||!/^\s*\d[\d\s\u00a0]*(?:[.,]\d{1,2})?\s*$/.test(v))return null;return observedPrice(Number(v.replace(/[\s\u00a0]/g,'').replace(',','.')));}
export function jsonLD(html:string):Json[]{const result:Json[]=[];function walk(v:unknown,depth=0){if(depth>12||result.length>500)return;if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1));return;}const o=object(v);if(!Object.keys(o).length)return;result.push(o);for(const value of Object.values(o))if(typeof value==='object')walk(value,depth+1);}
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 return result;
}
export function extractOffers(html:string,source:string,city:string,checkedAt=new Date().toISOString()):SearchHit[]{
 const micro=microdataOffer(html,source,city,checkedAt);
 const reviewed=sellerOffers(html,source,city,checkedAt);
 if(reviewed.length)return reviewed;
 const ld=jsonLD(html),nodes=ld.some(n=>type(n,'Product'))?ld:microdata(html),publisher=object(nodes.find(n=>type(n,'WebSite'))?.publisher);
 const results=nodes.filter(n=>type(n,'Product')).slice(0,12).flatMap(p=>{
  const title=text(p.name);if(!title)return [];
  const offers=[p.offers].flat().map(object).filter(o=>Object.keys(o).length&&!type(o,'AggregateOffer'));
  if(!offers.length)return []; // Product markup alone is not an offer.
  return offers.slice(0,3).map((offer,index)=>{
   const seller=object(offer.seller),currency=text(offer.priceCurrency,8).toUpperCase();
   const price=currency==='RUB'?observedPrice(offer.price):null;
   const sellerName=text(seller.name)||text(publisher?.name)||new URL(source).hostname;
   const brand=text(object(p.brand).name)||text(p.brand),model=text(p.model);
   const productLink=productURL(p.url,source),image=productImage(p.image,source);
   const availability=text(offer.availability),sourceAvailability=availability.endsWith('OutOfStock')?'out_of_stock' as const:availability.endsWith('InStock')?'in_stock' as const:'unknown' as const;
   const priceCondition=nodes.filter(n=>type(n,'Product')).length===1?html.match(/<[^>]+data-testid=["']product-page\.price-total["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]:null;
   // Shipping addresses / organization HQ / generic availability do not establish stock at a branch.
   const availableAt=object(offer.availableAtOrFrom),addr=object(availableAt.address),geo=object(availableAt.geo);
   const address=text(addr.streetAddress,300)||null,locality=text(addr.addressLocality,100);
   const lat=Number(geo.latitude),lng=Number(geo.longitude);
   const point=address&&locality&&geo.latitude!==undefined&&geo.longitude!==undefined&&Number.isFinite(lat)&&Math.abs(lat)<=85&&Number.isFinite(lng)&&Math.abs(lng)<=180?{lat,lng}:null;
   return {id:'offer:'+source+':'+index+':'+title,kind:'product',title,description:[brand,model,priceCondition?'Условие цены: '+text(priceCondition,150):''].filter(Boolean).join(' · '),category:'',city:point?locality:'',address:point?address:null,point,phone:point?text(availableAt.telephone,100)||null:null,site:productLink&&new URL(productLink).hostname===new URL(source).hostname?productLink:source,hours:null,source,checkedAt,price,image,status:'website',distanceKm:null,seller:sellerName,currency:price===null?null:'RUB',priceEvidence:price===null?null:'Структурированные данные Offer.price',evidence:'source-page',locationEvidence:point?'confirmed-point':'unverified',sourceAvailability} satisfies SearchHit;
  });
 });
 return results.length?results:micro;
}
function attr(tag:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return tag.match(new RegExp('\\b'+escaped+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'';}
function decode(v:string){return v.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');}
export function microdataOffer(html:string,source:string,city:string,checkedAt:string):SearchHit[]{
 const products=[...html.matchAll(/<[^>]+itemtype\s*=\s*["']https?:\/\/schema\.org\/Product["'][^>]*>/gi)];
 const offers=[...html.matchAll(/<[^>]+itemtype\s*=\s*["']https?:\/\/schema\.org\/Offer["'][^>]*>/gi)];
 if(products.length!==1||offers.length!==1)return []; // Ambiguous catalog/recommendation markup: do not guess associations.
 const meta=[...html.slice(products[0].index).matchAll(/<meta\b[^>]*>/gi)].map(m=>({prop:attr(m[0],'itemprop').toLowerCase(),value:decode(attr(m[0],'content'))}));
 const prices=meta.filter(m=>m.prop==='price'),currencies=meta.filter(m=>m.prop==='pricecurrency'),title=meta.find(m=>m.prop==='name')?.value;
 if(!title||prices.length!==1||currencies.length!==1||currencies[0].value!=='RUB')return [];
 const price=observedPrice(prices[0].value);if(price===null)return [];
 const condition=html.match(/<[^>]+data-testid=["']product-page\.price-total["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
 const available=meta.find(m=>m.prop==='availability')?.value||'';
 const image=meta.find(m=>m.prop==='image')?.value;
 return [{...pageHit(source,title,''),id:'offer:'+source,kind:'product',price,currency:'RUB',seller:new URL(source).hostname,image:productImage(image,source),description:condition?'Условие цены: '+text(decode(condition),150):'Условия опубликованной цены уточняйте у продавца.',checkedAt,priceEvidence:'Microdata Offer.price',evidence:'source-page',locationEvidence:'unverified',sourceAvailability:available.endsWith('OutOfStock')?'out_of_stock':available.endsWith('InStock')?'in_stock':'unknown'}];
}
export function pageHit(url:string,title:string,city:string):SearchHit{return {id:'web:'+url,kind:'page',title:text(title)||new URL(url).hostname,description:'Найдена страница. Конкретное предложение, цену и наличие пока не удалось подтвердить.',category:'',city,address:null,point:null,phone:null,site:safeHTTP(url),hours:null,source:url,checkedAt:new Date().toISOString(),price:null,image:null,status:'website',distanceKm:null};}
// Search-result excerpts are indexed source evidence, not model inventory. A
// result becomes an offer only with a product-shaped URL and an explicit RUB
// price. Availability and a physical branch deliberately remain unknown.
export function indexedOfferHit(url:string,title:string,snippet:string|undefined,city:string):SearchHit {
 const fallback=pageHit(url,title,city),u=new URL(url),copy=text(`${title} ${snippet||''}`,700);
 const productPath=/(?:\/product\/|\/products\/|\/tovar\/|\/item\/|\/catalog\/[^/]+\/[^/]+|-[0-9]{4,}\/?$)/iu.test(u.pathname);
 const found=copy.match(/(?:цена\s*[:—-]?\s*)?(\d[\d\s\u00a0]{0,12}(?:[.,]\d{1,2})?)\s*(?:₽|руб(?:\.|лей)?)/iu);
 const price=found?observedPrice(found[1]):null;
 // A product-shaped seller URL plus its indexed title proves that a concrete
 // product page exists. It does not prove a price or branch stock.
 if(!productPath)return fallback;
 const cleanTitle=text(title.replace(/\s+(?:купить|по цене|цена)\b[\s\S]*$/iu,''),300)||fallback.title;
 return {...fallback,id:'indexed-offer:'+url,kind:'product',title:cleanTitle,city:'',description:price===null?'Интернет-страница товара. Продажа и точка в выбранном городе не подтверждены.':'Цена опубликована в интернет-источнике; магазин в выбранном городе и наличие в филиале не подтверждены.',price,currency:price===null?null:'RUB',seller:u.hostname.replace(/^www\./,''),priceEvidence:price===null?null:'Цена в индексированном фрагменте источника',evidence:'search-index',locationEvidence:'unverified',sourceAvailability:'unknown'};
}
