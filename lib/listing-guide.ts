export type ListingPoint={label:string;city?:string;lat:number;lng:number};
export type ListingDraft={id:string;sellerName?:string;sellerType?:'private'|'business';companyName?:string;name:string;description:string;category:string;condition:''|'new'|'used';price:string;priceMode:'fixed'|'negotiable'|'free';photos:string[];selectedCity?:ListingPoint|null;city:string;street:string;phone:string;point:ListingPoint|null};
export const listingSteps=['Товар и цена','Место и продавец','Проверка'] as const;
type ListingIssue={field:string;step:0|1;message:string};
export function listingIssues(d:ListingDraft,step:number):ListingIssue[]{
 const issues:ListingIssue[]=[];
 if(!d.photos.length)issues.push({field:'photos',step:0,message:'Добавьте хотя бы одну фотографию'});
 if(d.name.trim().length<3)issues.push({field:'name',step:0,message:'Укажите название товара'});
 if(!d.condition)issues.push({field:'condition',step:0,message:'Выберите: новый или б/у'});
 if(d.priceMode==='fixed'&&(!d.price.trim()||!Number.isFinite(Number(d.price))||Number(d.price)<0||Number(d.price)>1e9))issues.push({field:'price',step:0,message:'Укажите цену или выберите «Договорная»'});
 if(d.description.trim().length<10)issues.push({field:'description',step:0,message:'Добавьте описание — хотя бы 10 символов'});
 if((d.sellerName||'').trim().length<2)issues.push({field:'seller-name',step:1,message:'Укажите имя продавца'});
 if(!/^\d{10,15}$/.test(d.phone.replace(/\D/g,'')))issues.push({field:'phone',step:1,message:'Укажите контактный телефон'});
 if(!d.city.trim()||!d.selectedCity&&!d.point)issues.push({field:'city',step:1,message:'Выберите город'});
 if(!d.street.trim()||!d.point||!Number.isFinite(d.point.lat)||!Number.isFinite(d.point.lng))issues.push({field:'street',step:1,message:'Выберите адрес из подсказок'});
 if(d.sellerType==='business'&&(d.companyName||'').trim().length<2)issues.push({field:'company',step:1,message:'Укажите название магазина или компании'});
 return step===2?issues:issues.filter(issue=>issue.step===step);
}
export function listingMissing(d:ListingDraft,step:number):string[]{
 return listingIssues(d,step).map(issue=>issue.message);
}
export function listingPrice(d:ListingDraft){return d.priceMode==='negotiable'?null:d.priceMode==='free'?0:Number(d.price);}
export type ListingSuggestion={name?:string;description?:string;category?:string;condition?:'new'|'used';price?:number;priceMode?:'fixed'|'free'|'negotiable'};
// Commercial facts come from explicit seller text, never model guesses.
export function listingFacts(message:string):ListingSuggestion{
 const facts:ListingSuggestion={},text=message.toLowerCase();
 if(/(?:^|[^а-яёa-z])б\s*\/?\s*у(?![а-яёa-z])|подержан|как нов|не нов/iu.test(text))facts.condition='used';
 else if(/не\s+(?:использовал|пользовал)|нов(?:ый|ая|ое|ые)(?![а-яёa-z])/iu.test(text))facts.condition='new';
 else if(/пользовал(?:ся|ась)/iu.test(text))facts.condition='used';
 if(/^(?:поставь|укажи|измени|замени|сделай|установи)\s+цену\s+(?:на\s+)?договорн(?:ой|ую|ая)[.!]?$/iu.test(text.trim()))facts.priceMode='negotiable';
 else if(!/не\s+(?:отдам|отдаю)\s+(?:бесплатно|даром)|не\s+даром/iu.test(text)&&/(?:отдам|отдаю) бесплатно|даром/iu.test(text)){facts.priceMode='free';facts.price=0;}
 else if(!/[$€]|доллар|евро|\busd\b|\beur\b|(?:^|\s)от\s+\d|\d\s*[-–—]\s*\d/iu.test(text)){
  const match=text.match(/(?:цен[ау]\s*[:—-]?\s*(?:на\s+)?|за\s+)(\d+(?:[ \u00a0]\d{3})*(?:[.,]\d{1,2})?)\s*(тыс(?:яч[аиу]?)?\.?|к(?![а-яёa-z])|миллион(?:а|ов)?)?/iu)||text.match(/(\d+(?:[ \u00a0]\d{3})*(?:[.,]\d{1,2})?)\s*(тыс(?:яч[аиу]?)?\.?|к(?![а-яёa-z])|миллион(?:а|ов)?)?\s*(?:₽|руб(?:лей|ля|ль)?\.?)/iu);
  if(match){const multiplier=match[2]?/миллион/iu.test(match[2])?1000000:1000:1,price=Number(match[1].replace(/\s/g,'').replace(',','.'))*multiplier;if(Number.isFinite(price)&&price>=0&&price<=1e9){facts.price=price;facts.priceMode='fixed';}}
 }
 return facts;
}
