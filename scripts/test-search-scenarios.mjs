import {writeFile} from 'node:fs/promises';
const origin='http://localhost:3000',report=[];
async function call(path,body){const start=performance.now(),r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});return {http:r.status,ms:Math.round(performance.now()-start),body:await r.json()};}
for(const [query,context] of [['Цветы до 1 000 рублей',null],['Подарок девочке до 1 000 рублей',null],['покажи дешевле',{query:'Аккумулятор Toyota RAV4 2017',maxPrice:8000}],['не дальше 5 км',{query:'Изготовление ключей'}]]){const r=await call('/api/search',{query,context:context||undefined,city:'Казань'});report.push({query,...r,body:{context:r.body.context,count:r.body.hits?.length,knownPrices:r.body.hits?.filter(h=>h.price!==null).length,sources:r.body.sources,warnings:r.body.warnings}});}
report.push({scenario:'Photo validation, no image sent to external API',...await call('/api/search-image',{image:'not-an-image',consent:true})});
// Real endpoints in Kazan / Zelenodolsk established by the geocoder, not user location.
const route=await call('/api/journey',{query:'Корм для собаки по дороге',city:'Казань',start:{lat:55.7963938,lng:49.1097699},end:{lat:55.8460298,lng:48.5064751},mode:'auto'});
report.push({scenario:'Казань, Кремлёвская 1 → Зеленодольск, Ленина 35',...route});
await writeFile('artifacts/search-scenarios.json',JSON.stringify({at:new Date().toISOString(),report},null,2));
for(const r of report)console.log(JSON.stringify({query:r.query||r.scenario,http:r.http,ms:r.ms,count:r.body.count??r.body.results?.length,context:r.body.context,error:r.body.error}));
