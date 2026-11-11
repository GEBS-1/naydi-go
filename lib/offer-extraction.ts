import {safeHTTP,type SearchHit} from './city-search';
import {microdata} from './microdata';
import {sellerOffers} from './seller-adapters';
type Json=Record<string,unknown>;
const object=(v:unknown):Json=>v&&typeof v==='object'&&!Array.isArray(v)?v as Json:{};
const type=(v:Json,t:string)=>[v['@type']].flat().some(x=>typeof x==='string'&&(x===t||x.endsWith('/'+t)));
const text=(v:unknown,max=250)=>typeof v==='string'?v.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
function productFacts(p:Json){
 const characteristics=[p.additionalProperty].flat().map(object).map(x=>({name:text(x.name,60),value:text(String(x.value??''),120)})).filter(x=>x.name&&x.value).slice(0,8);
 for(const [key,label] of [['color','Цвет'],['material','Материал'],['size','Размер']] as const){const value=text(p[key],120);if(value&&!characteristics.some(x=>x.name===label))characteristics.push({name:label,value});}
 const r=object(p.aggregateRating),value=Number(r.ratingValue),best=Number(r.bestRating??5),count=Number(r.ratingCount??r.reviewCount);
 return {model:text(p.model,120)||undefined,brand:text(object(p.brand).name)||text(p.brand)||undefined,characteristics,
  rating:r.ratingValue!==undefined&&Number.isFinite(value)&&value>=0&&Number.isFinite(best)&&best>0&&value<=best?{value,best,count:Number.isInteger(count)&&count>0?count:null}:undefined};
}
function productURL(value:unknown,source:string){try{return typeof value==='string'?safeHTTP(new URL(value,source).href):null;}catch{return null;}}
function productImage(value:unknown,source:string):string|null{
 const candidate=Array.isArray(value)?value[0]:value;
 const raw=typeof candidate==='string'?candidate:text(object(candidate).url||object(candidate).contentUrl,2000);
 if(!raw)return null;
 try{const url=new URL(raw,source);return url.protocol==='https:'?url.href:null;}catch{return null;}
}
function pageImage(html:string,source:string):string|null{
 for(const tag of html.matchAll(/<meta\b[^>]*>/gi)){
  const raw=tag[0],key=(attr(raw,'property')||attr(raw,'name')).toLowerCase();
  if(!['og:image','og:image:url','twitter:image'].includes(key))continue;
  const image=productImage(decode(attr(raw,'content')),source);if(image)return image;
 }
 return null;
}
export function observedPrice(v:unknown):number|null{if(typeof v==='number')return Number.isFinite(v)&&v>=0&&v<=1e9?v:null;if(typeof v!=='string'||!/^\s*\d[\d\s\u00a0]*(?:[.,]\d{1,2})?\s*$/.test(v))return null;return observedPrice(Number(v.replace(/[\s\u00a0]/g,'').replace(',','.')));}
export function jsonLD(html:string):Json[]{const result:Json[]=[];function walk(v:unknown,depth=0){if(depth>12||result.length>500)return;if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1));return;}const o=object(v);if(!Object.keys(o).length)return;result.push(o);for(const value of Object.values(o))if(typeof value==='object')walk(value,depth+1);}
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 return result;
}
export function extractOffers(html:string,source:string,city:string,checkedAt=new Date().toISOString()):SearchHit[]{
 const fallbackImage=pageImage(html,source);
 const micro=microdataOffer(html,source,city,checkedAt);
 const reviewed=sellerOffers(html,source,city,checkedAt);
 // A page-level OpenGraph image is often the shop banner or a category hero.
 // Never attach it to every extracted product as if it were the item's photo.
 if(reviewed.length)return reviewed;
 const ld=jsonLD(html),nodes=ld.some(n=>type(n,'Product'))?ld:microdata(html),publisher=object(nodes.find(n=>type(n,'WebSite'))?.publisher);
 const productNodes=nodes.filter(n=>type(n,'Product'));
 const pageCategory=text(decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1]||''),200);
 const categoryPath=new URL(source).pathname.replace(/\/+$/,'');
 const results=productNodes.slice(0,12).flatMap(p=>{
  const title=text(p.name);if(!title)return [];
  const offers=[p.offers].flat().map(object).filter(o=>Object.keys(o).length&&!type(o,'AggregateOffer'));
  if(!offers.length)return []; // Product markup alone is not an offer.
  return offers.slice(0,3).map((offer,index)=>{
   const seller=object(offer.seller),currency=text(offer.priceCurrency,8).toUpperCase();
   const price=currency==='RUB'?observedPrice(offer.price):null;
   const sellerName=text(seller.name)||text(publisher?.name)||new URL(source).hostname;
   const productLink=productURL(p.url,source),directLink=productLink&&new URL(productLink).hostname===new URL(source).hostname?productLink:null;
   // Catalog membership is published evidence for season/gender/type, even when
   // the individual item's title only says "пуховик". Do not borrow this context
   // for recommendations linked outside this category or from a product page.
   const category=text(p.category)||text(object(p.category).name)||(categoryPath.split('/').filter(Boolean).length>=2&&directLink&&new URL(directLink).pathname.startsWith(categoryPath+'/')&&!/\.(?:html?|aspx?)$/iu.test(categoryPath)?pageCategory:'');
   const image=productImage(p.image,source)||(productNodes.length===1?fallbackImage:null),facts=productFacts(p);
   const availability=text(offer.availability),sourceAvailability=availability.endsWith('OutOfStock')?'out_of_stock' as const:availability.endsWith('InStock')?'in_stock' as const:'unknown' as const;
   const priceCondition=nodes.filter(n=>type(n,'Product')).length===1?html.match(/<[^>]+data-testid=["']product-page\.price-total["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]:null;
   // Shipping addresses / organization HQ / generic availability do not establish stock at a branch.
   const availableAt=object(offer.availableAtOrFrom),addr=object(availableAt.address),geo=object(availableAt.geo);
   const address=text(addr.streetAddress,300)||null,locality=text(addr.addressLocality,100);
   const lat=Number(geo.latitude),lng=Number(geo.longitude);
   const point=address&&locality&&geo.latitude!==undefined&&geo.longitude!==undefined&&Number.isFinite(lat)&&Math.abs(lat)<=85&&Number.isFinite(lng)&&Math.abs(lng)<=180?{lat,lng}:null;
   return {...facts,id:'offer:'+(directLink||source)+':'+index+':'+title,kind:'product',title,description:[text(p.description,4000),priceCondition?'Условие цены: '+text(priceCondition,150):''].filter(Boolean).join(' · '),category,city:point?locality:'',address:point?address:null,point,phone:point?text(availableAt.telephone,100)||null:null,site:directLink||source,hours:null,source:directLink||source,checkedAt,price,image,status:'website',distanceKm:null,seller:sellerName,currency:price===null?null:'RUB',priceEvidence:price===null?null:'Структурированные данные Offer.price',evidence:'source-page',locationEvidence:point?'confirmed-point':'unverified',sourceAvailability} satisfies SearchHit;
  });
 });
 return results.length?results:micro.map(offer=>offer.image?offer:{...offer,image:fallbackImage});
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
 const image=meta.find(m=>m.prop==='image')?.value||pageImage(html,source);
 return [{...pageHit(source,title,''),id:'offer:'+source,kind:'product',price,currency:'RUB',seller:new URL(source).hostname,image:productImage(image,source),description:condition?'Условие цены: '+text(decode(condition),150):'Условия опубликованной цены уточняйте у продавца.',checkedAt,priceEvidence:'Microdata Offer.price',evidence:'source-page',locationEvidence:'unverified',sourceAvailability:available.endsWith('OutOfStock')?'out_of_stock':available.endsWith('InStock')?'in_stock':'unknown'}];
}
export function pageHit(url:string,title:string,city:string):SearchHit{return {id:'web:'+url,kind:'page',title:text(title)||new URL(url).hostname,description:'Найдена страница. Конкретное предложение, цену и наличие пока не удалось подтвердить.',category:'',city,address:null,point:null,phone:null,site:safeHTTP(url),hours:null,source:url,checkedAt:new Date().toISOString(),price:null,image:null,status:'website',distanceKm:null};}
// Indexed excerpts can describe an offer without establishing stock or a branch.
export function indexedOfferHit(url:string,title:string,snippet:string|undefined,city:string):SearchHit {
 const fallback=pageHit(url,title,city),u=new URL(url),copy=text(`${title} ${snippet||''}`,700);
 const path=u.pathname.toLowerCase(),leaf=path.split('/').filter(Boolean).at(-1)||'';
 // A category URL may be several levels deep under /catalog. Only accept
 // explicit product routes, a SKU-like final segment, or a non-listing
 // product document. Never turn a category/listing page into a product card.
 const directProductPath=/\/(?:product|products|tovar|item|goods|p)\/[^/]+\/?$/iu.test(path);
 const skuProductPath=/\d{3,}/u.test(leaf)&&!/(?:^|\/)(?:category|categories|search|filter|brand|brands)(?:\/|$)/iu.test(path)&&!/(?:^|[-_])(?:catalog|category|search|filter|brand|brands)(?:[-_]|$)/iu.test(leaf);
 const documentProductPath=/\.(?:html?|aspx?)$/iu.test(leaf)&&!/(?:^|\/)(?:catalog|category|categories|brand|brands|search|tag|sale|catalogue)(?:\/|$)/iu.test(path);
 const listingTitle=/(?:каталог|каталог моделей|выбор по параметрам|наборы гаечных ключей.*(?:мм и|производители)|цены от|выгодные цены от)/iu.test(title);
 const classifiedListing=/(?:^|\.)avito\.ru$/iu.test(u.hostname)&&!/_\d{7,}$/u.test(leaf);
 const telegram=u.hostname==='t.me';
 const vk=['vk.com','www.vk.com','m.vk.com','vk.ru','www.vk.ru'].includes(u.hostname);
 const publicPost=telegram
  ? /^\/(?:s\/)?[a-z][a-z0-9_]{4,}\/\d+\/?$/iu.test(path)&&!path.startsWith('/c/')
  : vk&&/^\/wall-?\d+_\d+\/?$/iu.test(path);
 const saleText=/(?:прода[юём]|продам|прода[её]тся|в наличии|самовывоз|в продаже|цена|₽|рублей)/iu.test(copy);
 const productPath=telegram||vk
  ? publicPost&&saleText
  : !listingTitle&&!classifiedListing&&(directProductPath||skuProductPath||documentProductPath);
 const found=copy.match(/(?:цена\s*[:—-]?\s*)?(\d[\d\s\u00a0]{0,12}(?:[.,]\d{1,2})?)\s*(?:₽|руб(?:\.|лей)?)/iu);
 const price=found?observedPrice(found[1]):null;
 // A product-shaped seller URL plus its indexed title proves that a concrete
 // product page exists. It does not prove a price or branch stock.
 if(!productPath)return fallback;
 const cleanTitle=text(title.replace(/\s+(?:купить|по цене|цена)\b[\s\S]*$/iu,''),300)||fallback.title;
 return {...fallback,id:'indexed-offer:'+url,kind:'product',title:cleanTitle,city:'',description:text(snippet,600),price,currency:price===null?null:'RUB',seller:u.hostname.replace(/^www\./,''),priceEvidence:price===null?null:'Цена в индексированном фрагменте источника',evidence:'search-index',locationEvidence:'unverified',sourceAvailability:'unknown'};
}
