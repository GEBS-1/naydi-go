import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://localhost:3000',report=[],out=process.env.VERIFY_OUTPUT_DIR||'artifacts/search-verification';
async function request(label,path,body){
 const start=performance.now();let entry;
 try{const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(150000)});entry={label,status:response.status,ms:Math.round(performance.now()-start),body:await response.json()};}
 catch(e){entry={label,ms:Math.round(performance.now()-start),error:e.message};}
 report.push(entry);await mkdir(out,{recursive:true});await writeFile(out+'/report.json',JSON.stringify({at:new Date().toISOString(),report},null,2));
 console.log(JSON.stringify({label,status:entry.status,ms:entry.ms,hits:entry.body?.hits?.length,products:entry.body?.hits?.filter(h=>h.kind==='product').length,mappable:entry.body?.hits?.filter(h=>h.point).length,routeStops:entry.body?.results?.filter(h=>h.shop).length,usage:entry.body?.usage,warnings:entry.body?.warnings,error:entry.error||entry.body?.error}));
 return entry.body;
}
const concrete={query:'Аккумулятор VARTA Blue Dynamic D24 60 Ач в Казани',city:'Казань'};
await request('Конкретный товар','/api/search',concrete);
await request('Повтор из кеша','/api/search',concrete);
await request('Подарок: уточнение возраста','/api/search',{query:'Найди подарок девочке до 1000 рублей',city:'Казань'});
await request('Подарок 7 лет','/api/search',{query:'Подарок девочке 7 лет до 1000 рублей',city:'Казань'});
await request('Дешевле и ближе','/api/search',{query:'покажи дешевле и ближе',city:'Казань',context:{query:concrete.query}});
const start=await request('Начало маршрута','/api/journey?q='+encodeURIComponent('Казань Кремлёвская 1'));
await new Promise(r=>setTimeout(r,1300));
const end=await request('Район назначения','/api/journey?q='+encodeURIComponent('Казань Дербышки'));
if(start?.places?.[0]&&end?.places?.[0])await request('Цветы по дороге в Дербышки','/api/journey',{query:'Найди цветы до 1000 рублей по дороге в Дербышки',city:'Казань',start:start.places[0],end:end.places[0],mode:'auto'});
await request('Услуга','/api/search',{query:'Изготовление ключей в Казани',city:'Казань'});
