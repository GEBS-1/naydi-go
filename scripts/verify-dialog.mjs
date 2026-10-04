import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const origin='http://localhost:3000',rows=[];
for(const query of ['Этот вариант дорогой, покажи похожие','Ищи ближе к дому','А что есть по дороге?']){
 const start=performance.now();const response=await fetch(origin+'/api/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({query,city:'Казань',context:{query:'беспроводные наушники',maxPrice:25000}})}),body=await response.json();
 assert.equal(response.status,200);assert.match(body.context.query,/наушник/iu);assert.equal(body.context.maxPrice,25000);
 if(query.startsWith('Этот'))assert.equal(body.context.sort,'price');
 rows.push({query,ms:Math.round(performance.now()-start),context:body.context,warnings:body.warnings,products:body.hits.filter(h=>h.kind==='product').length,usage:body.usage});console.log(JSON.stringify(rows.at(-1)));
 await writeFile('artifacts/mvp-20260926/dialog.json',JSON.stringify(rows,null,2));
}
