import {writeFile,mkdir} from 'node:fs/promises';
const query=process.argv[2]||'Купить настольную игру UNO в Казани',start=performance.now(),origin=process.env.PROBE_ORIGIN||'http://localhost:3000',city=process.argv[3]||'Казань';
const r=await fetch(origin+'/api/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({query,city}),signal:AbortSignal.timeout(120000)}),b=await r.json();
await mkdir('artifacts/mvp-final',{recursive:true});await writeFile('artifacts/mvp-final/probe-search.json',JSON.stringify({query,city,origin,status:r.status,ms:performance.now()-start,...b},null,2));
console.log(JSON.stringify({status:r.status,ms:Math.round(performance.now()-start),sources:b.sources,usage:b.usage,hits:b.hits?.filter(h=>h.status!=='organization').map(h=>({kind:h.kind,title:h.title,price:h.price,seller:h.seller,source:h.source})),warnings:b.warnings,error:b.error}));
