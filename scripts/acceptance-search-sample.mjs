// Real local app + external providers. Read-only requests except normal search analytics/cache.
const base='http://127.0.0.1:3001';
const cases=[
 {query:'карандаш для бровей',city:'Казань',near:{lat:55.7963,lng:49.1088}},
 {query:'детский велосипед 14 дюймов',city:'Казань',near:{lat:55.829,lng:49.131}},
 {query:'ремонт обуви',city:'Казань',near:{lat:55.750,lng:49.200}},
 {query:'лампа светодиодная E27 12 Вт',city:'Казань',near:{lat:55.779,lng:49.145}},
 {query:'шариковая ручка синяя',city:'Казань',near:{lat:55.810,lng:49.065}},
 {query:'зарядка для ноутбука Lenovo 65 Вт',city:'Казань',near:{lat:55.763,lng:49.123}},
];
for(const item of cases){
 const started=performance.now();
 try{
  const response=await fetch(base+'/api/search',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(item),signal:AbortSignal.timeout(110000)});
  const data=await response.json();const hits=Array.isArray(data.hits)?data.hits:[];
  const product=hits.filter(x=>x.kind==='product'),mapped=hits.filter(x=>x.point&&x.address);
  console.log(JSON.stringify({query:item.query,http:response.status,ms:Math.round(performance.now()-started),phase:data.phase,hits:hits.length,products:product.length,mapped:mapped.length,sources:data.sources,warnings:data.warnings,knownCostRub:data.usage?.knownCostRub,costComplete:data.usage?.costComplete,tokens:data.usage?.calls?.reduce((sum,c)=>sum+(c.tokens||0),0),sample:hits.slice(0,3).map(x=>({kind:x.kind,title:x.title,price:x.price,address:x.address,point:!!x.point,source:x.source}))}));
 }catch(error){console.log(JSON.stringify({query:item.query,error:String(error),ms:Math.round(performance.now()-started)}));}
}
