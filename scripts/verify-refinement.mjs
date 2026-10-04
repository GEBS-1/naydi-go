import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const origin='http://localhost:3000',report=JSON.parse(await readFile('artifacts/search-verification/report.json','utf8'));
const near=report.report.find(x=>x.label==='Начало маршрута').body.places[0];
const start=performance.now(),response=await fetch(origin+'/api/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({query:'покажи дешевле и ближе',city:'Казань',near,context:{query:'Аккумулятор VARTA Blue Dynamic D24 60 Ач в Казани'}})}),body=await response.json();
assert.equal(response.status,200);assert.equal(body.context.sort,'price-distance');assert(body.hits.some(h=>h.distanceKm!==null));assert(body.hits.every(h=>!h.point||h.address));assert.equal(body.usage.knownCostRub,0);
await writeFile('artifacts/search-verification/refinement.json',JSON.stringify({ms:performance.now()-start,body},null,2));
console.log(JSON.stringify({status:response.status,ms:Math.round(performance.now()-start),costRub:body.usage.knownCostRub,context:body.context,mappable:body.hits.filter(h=>h.point).length}));
