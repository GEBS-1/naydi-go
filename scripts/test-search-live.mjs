import {writeFile,readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
const origin=process.env.LOCAL_ORIGIN||'http://localhost:3000';
const queries=['Изготовление ключей в Казани','Где сделать дубликат ключа рядом?','Аккумулятор Toyota RAV4 2017 в Казани','Автозапчасти рядом','Автотовары','Купить корм для собаки','Зоотовары','Корм для кошки','Купить материалы для ремонта ванной','Всё для ремонта ванной','Сантехника','Купить лампочку','Купить велосипед','Спорт и хобби','Беспроводные наушники','Электроника','Семена для дачи','Цветы','Стрижка рядом','Ремонт обуви'];
const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';const file=(await readdir(folder)).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');
const database=new DatabaseSync(path.join(folder,file),{readOnly:true});
const calls=()=>database.prepare('SELECT id,provider,model,status,actual,data FROM api_calls').all();
const before=new Set(calls().map(c=>c.id));
const privateStores=JSON.parse(await readFile('artifacts/local-previews.json','utf8')).map(s=>s.id);
const results=[];
for(const query of queries){const start=performance.now(),beforeIds=new Set(calls().map(c=>c.id));try{
 const r=await fetch(origin+'/api/search',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({query,city:'Казань'}),signal:AbortSignal.timeout(50000)}),body=await r.json();
 const hits=body.hits||[];if(hits.some(h=>privateStores.includes(h.id)||privateStores.includes(h.shop?.id)))throw Error('PRIVATE LEAK');
 const row={query,status:r.status,elapsedMs:Math.round(performance.now()-start),timing:body.timing,counts:{all:hits.length,products:hits.filter(h=>h.kind==='product').length,organizations:hits.filter(h=>h.status==='organization').length,mappable:hits.filter(h=>h.point&&h.address).length},sources:body.sources,examples:hits.slice(0,3).map(h=>({title:h.title,source:h.source,address:h.address,site:h.site,point:h.point})),apiCalls:calls().filter(c=>!beforeIds.has(c.id)),warnings:body.warnings||[],error:body.error||null};
 results.push(row);console.log(JSON.stringify({query,count:hits.length,mappable:row.counts.mappable,ms:row.elapsedMs,sources:body.sources,error:row.error}));
 }catch(e){results.push({query,error:e.message,elapsedMs:Math.round(performance.now()-start)});console.log(query,e.message);}
 // Respect public providers: no parallel load testing.
 await new Promise(resolve=>setTimeout(resolve,3500));
}
const report={at:new Date().toISOString(),origin,queries:results,calls:calls().filter(c=>!before.has(c.id))};
await writeFile('artifacts/search-live-report.json',JSON.stringify(report,null,2));database.close();
console.log('Saved artifacts/search-live-report.json');
