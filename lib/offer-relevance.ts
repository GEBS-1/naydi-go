import {normalize} from './search';
import {safeHTTP,type SearchHit} from './city-search';
/** Prefer seller-confirmed online availability; keep sold-out offers visible but lower-ranked. */
export function offerAvailabilityAdjustment(hit:Pick<SearchHit,'kind'|'sourceAvailability'>){
 if(hit.kind!=='product')return 0;
 return hit.sourceAvailability==='in_stock'?8:hit.sourceAvailability==='out_of_stock'?-80:0;
}
export function hasFreshOwnedStock(hits:Pick<SearchHit,'status'|'sourceAvailability'|'checkedAt'>[],now=Date.now()){
 return hits.some(hit=>hit.status==='seller-confirmed'&&hit.sourceAvailability==='in_stock'&&!!hit.checkedAt&&now-Date.parse(hit.checkedAt)<3600000);
}
export function offerFreshness(checkedAt:string|undefined,now=Date.now()):'recent'|'stale'|'unknown'{
 if(!checkedAt)return 'unknown';const checked=Date.parse(checkedAt);if(!Number.isFinite(checked)||checked>now+5*60_000)return 'unknown';
 return now-checked<=24*60*60_000?'recent':'stale';
}
export function informationalPage(hit:Pick<SearchHit,'title'|'description'|'source'>){
 let path='';try{const u=new URL(hit.source);path=(u.pathname+' '+u.hostname).toLowerCase();}catch{return true;}
 const text=normalize(`${hit.title} ${hit.description} ${path}`);
 return /(?:^|\s)(?:как|зачем|почему|инструкция|руководство|советы|обзор|рейтинг|статья|блог|форум|новости)(?:\s|$)/u.test(text)||/(?:замена|установка|ремонт|своими руками|пошагов)/u.test(text)||/\/(?:article|articles|blog|news|journal|help|advice|how-to|instruction|review|reviews|wiki|forum)(?:\/|-|$)/iu.test(path);
}
// Catalogs contain recommendations unrelated to the query. Extraction is not relevance.
export function relevantOffers(hits:SearchHit[],query:string,city:string){
 const broad=/подар|посовет|подобрать|вс[её] для|(?:корейск|азиатск).*космет|^\s*(?:дом и ремонт|автотовары|авто|автозапчасти|спорт и хобби|электроника|сад и дача|зоотовары|красота и здоровье|косметика|продукты|креп[её]ж|метизы|инструменты)\s*$/iu.test(query);
 const size=query.match(/размер[а-я]*\s*[:№]?\s*(\d{2,3})(?!\d)|(?<!\d)(\d{2,3})(?:[-–](?:го|й|ый))?\s*размер/iu);
 const requestedSize=size?.[1]||size?.[2];
 const watts=[...query.matchAll(/(?<!\d)(\d+(?:[,.]\d+)?)\s*(?:вт|ватт(?:а|ов)?|w)(?![а-яёa-z])/giu)].map(m=>Number(m[1].replace(',','.')));
 const modelCodes=[...query.matchAll(/\b[a-z]{2,}(?:[- ]?)\d[a-z0-9–-]*\b/gi)].map(match=>normalize(match[0]));
 const clean=normalize(query.replace(/размер[а-я]*\s*[:№]?\s*\d{2,3}|\d{2,3}(?:[-–](?:го|й|ый))?\s*размер[а-я]*/giu,'').replace(/-?site:\S+/giu,'').replace(/(?:до|не дороже|бюджет)\s*\d[\d\s]*(?:[,.]\d+)?\s*(?:рублей|руб|₽)?/giu,''));
 const stop=new Set(['найди','найти','купить','хочу','нужно','нужен','нужна','нужны','покажи','где','для','мне','есть','рублей','руб','рядом','со','мной','по','дороге','пути','недорого','самовывоз','магазин','адрес','офлайн',...normalize(city).split(' ')]);
 const tokens=clean.split(' ').filter(t=>t.length>2&&!stop.has(t)&&!/^\d+$/.test(t));
 const stem=(s:string)=>s.length>5?s.slice(0,-2):s.length>3?s.slice(0,-1):s;
 const aliases=[['лампоч','ламп'],['корм','консерв'],['беспровод','bluetooth','tws','wireless'],['кош','кот'],['собак','щен'],['куртк','пуховик','анорак']];
 return hits.filter(h=>{
  if(h.kind!=='product'){
   if(h.kind!=='page'){
    const text=normalize(`${h.title} ${h.category} ${h.description} ${h.source}`);
    // A directory can contain dozens of businesses. Every one must still fit the purchase.
    if(/раскраск|книг|книжк/iu.test(query))return /раскраск|книг|книж|канц|игруш|детск|читай|букв|books|stationery|toys/u.test(text)&&!/автосервис|детейлинг|кузов|autoservice|pokrask/u.test(text);
    if(/гаечн|ключ.*(?:торцев|рожков|накидн)/iu.test(query)&&/изготовлен.*ключ|key_cutter|locksmith/u.test(text))return false;
    if(!/ремонт|покраск|мастерск|услуг|почин/iu.test(query)&&/автосервис|кузовн.*ремонт|ремонт.*вмятин|autoservice/u.test(text))return false;
    return true;
   }
   try{const u=new URL(h.source);if(/\.(?:kz|by|ua)$/.test(u.hostname)||['play.google.com','youtube.com','www.youtube.com'].includes(u.hostname)||informationalPage(h))return false;}catch{return false;}
   if(!broad&&tokens.length){
    const pageText=normalize(`${h.title} ${h.description} ${h.source}`);
    const related=tokens.some(token=>{const root=stem(token),group=aliases.find(g=>g.some(a=>root.startsWith(a)||a.startsWith(root)));return pageText.includes(root)||!!group?.some(a=>pageText.includes(a));});
    if(!related)return false;
   }
   return true;
  }
  const source=safeHTTP(h.site||h.source);
  if(source){
   const url=new URL(source);
   if(/\.(?:kz|by|ua)$/i.test(url.hostname)||/^\/(?:kz|by|ua)\/ru(?:\/|$)/i.test(url.pathname))return false;
  }
  const attributes=h.characteristics||h.product?.attributes||[];
  const productText=`${h.title} ${h.description} ${h.model||h.product?.model||''} ${attributes.map(a=>a.name+' '+a.value).join(' ')}`;
  if(watts.length){
   // Reject a different stated wattage in the product name; a description may
   // mention compatibility with several devices and is not product identity.
   const named=[...h.title.matchAll(/(?<!\d)(\d+(?:[,.]\d+)?)\s*(?:вт|ватт(?:а|ов)?|w)(?![а-яёa-z])/giu)].map(m=>Number(m[1].replace(',','.')));
   if(named.length&&!watts.some(watt=>named.includes(watt)))return false;
  }
  if(modelCodes.some(code=>!(' '+normalize(productText)+' ').includes(' '+code+' ')))return false;
  if(requestedSize){
   const sizeValues=attributes.filter(a=>/размер|^size$/iu.test(a.name)).map(a=>a.value);
   const textSizes=[...productText.matchAll(/размер[а-я]*\s*[:№]?\s*((?:\d{2,3}(?:\s*[,/–-]\s*)?)+)|(?<!\d)(\d{2,3})\s*(?:р-р|размер)/giu)]
    .map(match=>match[1]||match[2]);
   if(![...sizeValues,...textSizes].some(value=>value.match(/\d+/g)?.some(number=>number===requestedSize)))return false;
  }
  if(/свечн[а-яё]*\s+(?:ключ|головк)|(?:ключ|головк)[а-яё]*\s+(?:для\s+)?свеч/iu.test(query)){
   const text=normalize(h.title+' '+h.description);
   return text.includes('свеч')&&(text.includes('ключ')||text.includes('голов'))&&!/(?:комплект|набор)\s+свеч|свеч[аи]\s+зажиган/u.test(text);
  }
  const title=normalize(h.title),text=normalize(productText+' '+h.category);
  if(/зимн/iu.test(query)&&/летн|демисезон|осенн|весенн/u.test(title)&&!/зимн/u.test(title))return false;
  if(/мужск|для мужчин/iu.test(query)&&/женск|для женщин|для девушек/u.test(title)&&!/мужск|унисекс/u.test(title))return false;
  if(!/аренд|прокат|напрокат/iu.test(query)&&/аренд|прокат|напрокат/u.test(text))return false;
  // Task phrases contain use-case words that product titles normally omit.
  // Require the purchasable product class, then use the extra words for
  // ranking/clarification rather than deleting valid seller cards.
  if(/перфоратор/iu.test(query))return /перфорат/u.test(text);
  if(/автомобильн.*компрессор|компрессор.*шин/iu.test(query))return /компрессор|насос/u.test(text);
  if(/настольн.*ламп|ламп.*для чтения/iu.test(query))return /(?:настоль.*(?:ламп|светильник)|(?:ламп|светильник).*настоль|ламп.*прищепк)/u.test(title);
  if(/городск.*(?:гибридн.*)?велосипед|велосипед.*(?:город|парк)/iu.test(query))return /велосипед/u.test(text)&&!/детск/u.test(text);
  if(broad||!tokens.length)return true;
  return tokens.every(token=>{const root=stem(token),group=aliases.find(g=>g.some(a=>root.startsWith(a)||a.startsWith(root)));return text.includes(root)||!!group?.some(a=>text.includes(a));});
 });
}
