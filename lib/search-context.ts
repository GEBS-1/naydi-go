export type SearchContext={query:string;maxPrice?:number;radiusKm?:number;sort?:'relevance'|'price';newOnly?:boolean};
export function resolveSearch(message:string,previous?:SearchContext):SearchContext {
 const refinement=/^(?:нет[, ]*|покажи |только |не дальше |дешевле|лучше )/iu.test(message.trim());
 const context:SearchContext=refinement&&previous?{...previous}:{query:message};
 const budget=message.match(/(?:до|не дороже|бюджет)\s*(\d[\d\s]*)(?:[,.](\d{1,2}))?\s*(тыс(?:яч)?\.?|к\b)?/iu);
 if(budget){const amount=Number(budget[1].replace(/\s/g,''))+(budget[2]?Number('0.'+budget[2]):0);context.maxPrice=amount*(budget[3]?1000:1);}
 const radius=message.match(/(?:не дальше|радиус(?:е)?|в пределах)\s*(\d+(?:[.,]\d+)?)\s*(?:км|километр)/iu);
 if(radius)context.radiusKm=Math.min(100,Number(radius[1].replace(',','.')));
 if(/дешевле|по цене/iu.test(message))context.sort='price';
 if(/только новы/iu.test(message))context.newOnly=true;
 if(refinement&&previous&&/по дороге|по пути/iu.test(message)&&!context.query.includes('по дороге'))context.query+=' по дороге';
 return context;
}
