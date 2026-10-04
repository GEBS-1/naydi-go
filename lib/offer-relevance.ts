import {normalize} from './search';
import type {SearchHit} from './city-search';
export function informationalPage(hit:Pick<SearchHit,'title'|'description'|'source'>){
 let path='';try{const u=new URL(hit.source);path=(u.pathname+' '+u.hostname).toLowerCase();}catch{return true;}
 const text=normalize(`${hit.title} ${hit.description} ${path}`);
 return /(?:^|\s)(?:как|зачем|почему|инструкция|руководство|советы|обзор|рейтинг|статья|блог|форум|новости)(?:\s|$)/u.test(text)||/(?:замена|установка|ремонт|своими руками|пошагов)/u.test(text)||/\/(?:article|articles|blog|news|journal|help|advice|how-to|instruction|review|reviews|wiki|forum)(?:\/|-|$)/iu.test(path);
}
// Catalogs contain recommendations unrelated to the query. Extraction is not relevance.
export function relevantOffers(hits:SearchHit[],query:string,city:string){
 const broad=/подар|посовет|подобрать|вс[её] для|(?:корейск|азиатск).*космет|^\s*(?:дом и ремонт|автотовары|авто|автозапчасти|спорт и хобби|электроника|сад и дача|зоотовары|красота и здоровье|косметика|продукты|креп[её]ж|метизы|инструменты)\s*$/iu.test(query);
 const clean=normalize(query.replace(/(?:до|не дороже|бюджет)\s*\d[\d\s]*(?:[,.]\d+)?\s*(?:рублей|руб|₽)?/giu,''));
 const stop=new Set(['найди','найти','купить','хочу','нужно','нужен','нужна','нужны','покажи','где','для','мне','есть','рублей','руб','рядом','со','мной','по','дороге','пути','недорого',...normalize(city).split(' ')]);
 const tokens=clean.split(' ').filter(t=>t.length>2&&!stop.has(t)&&!/^\d+$/.test(t));
 const stem=(s:string)=>s.length>5?s.slice(0,-2):s.length>3?s.slice(0,-1):s;
 return hits.filter(h=>{
  if(h.kind!=='product'){
   if(h.kind!=='page')return true;
   try{const u=new URL(h.source);if(/\.(?:kz|by|ua)$/.test(u.hostname)||['play.google.com','youtube.com','www.youtube.com'].includes(u.hostname)||informationalPage(h))return false;}catch{return false;}
   return true;
  }
  if(/свечн[а-яё]*\s+(?:ключ|головк)|(?:ключ|головк)[а-яё]*\s+(?:для\s+)?свеч/iu.test(query)){
   const text=normalize(h.title+' '+h.description);
   return text.includes('свеч')&&(text.includes('ключ')||text.includes('голов'))&&!/(?:комплект|набор)\s+свеч|свеч[аи]\s+зажиган/u.test(text);
  }
  const text=normalize(h.title+' '+h.description);
  // Task phrases contain use-case words that product titles normally omit.
  // Require the purchasable product class, then use the extra words for
  // ranking/clarification rather than deleting valid seller cards.
  if(/перфоратор/iu.test(query))return /перфорат/u.test(text);
  if(/автомобильн.*компрессор|компрессор.*шин/iu.test(query))return /компрессор|насос/u.test(text);
  if(/настольн.*ламп|ламп.*для чтения/iu.test(query))return /ламп/u.test(text)&&/настоль|офис|рабоч/u.test(text);
  if(/городск.*(?:гибридн.*)?велосипед|велосипед.*(?:город|парк)/iu.test(query))return /велосипед/u.test(text)&&!/детск/u.test(text);
  if(broad||!tokens.length)return true;
  const aliases=[['лампоч','ламп'],['корм','консерв'],['беспровод','bluetooth','tws','wireless'],['кош','кот'],['собак','щен']];
  return tokens.every(token=>{const root=stem(token),group=aliases.find(g=>g.some(a=>root.startsWith(a)||a.startsWith(root)));return text.includes(root)||!!group?.some(a=>text.includes(a));});
 });
}
