import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://localhost:3000',rows=[];
for(const query of ['корм для кошек','корм для собак','беспроводные наушники','велосипед','лампочку']){
 for(const run of ['first','repeat']){
  const start=performance.now();
  try{
   const r=await fetch(origin+'/api/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({query,city:'Казань'}),signal:AbortSignal.timeout(120000)}),b=await r.json();
   const products=(b.hits||[]).filter(h=>h.kind==='product');
   rows.push({query,run,http:r.status,ms:Math.round(performance.now()-start),products:products.map(h=>({title:h.title,price:h.price,seller:h.seller,source:h.source,url:h.site,point:h.point,checkedAt:h.checkedAt})),sources:b.sources,usage:b.usage,warnings:b.warnings,error:b.error});
   console.log(JSON.stringify({query,run,http:r.status,ms:rows.at(-1).ms,products:products.length,priced:products.filter(h=>h.price!==null).length,sources:b.sources,usage:b.usage}));
  }catch(e){rows.push({query,run,error:e.message});console.log(query,run,e.message);}
  await mkdir('artifacts/mvp-20260926',{recursive:true});await writeFile('artifacts/mvp-20260926/catalog-search.json',JSON.stringify(rows,null,2));
 }
}
