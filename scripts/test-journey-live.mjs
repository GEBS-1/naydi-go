import assert from 'node:assert/strict';
const origin=process.env.LOCAL_ORIGIN||'http://localhost:3000';
async function places(q){const r=await fetch(origin+'/api/journey?q='+encodeURIComponent(q));const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));assert(b.places.length>0,q);console.log('Адрес:',b.places[0].label);return b.places[0];}
const start=await places('Баумана 20'),end=await places('Чистопольская 20');
for(const [mode,query] of [['auto','насос для машины'],['pedestrian','наушники'],['auto','смеситель']]){const r=await fetch(origin+'/api/journey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,start,end,mode})});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));assert(b.route.seconds>0);assert(b.route.points.length>2);assert(b.results.every(x=>x.shop.addressConfirmed&&!x.shop.demo&&x.shop.visibility==='public'&&x.extraSeconds>=0&&x.extraSeconds<=900));console.log('PASS',query,mode,Math.ceil(b.route.seconds/60),'мин,',b.results.length,'магазинов');}
// Real via routing, not a straight-line estimate; no synthetic shop is published.
const stop=await places('Казань улица Пушкина 1');
assert(stop.label.startsWith('Казань,'),'Промежуточная точка должна находиться в Казани');
async function route(points){const url=(process.env.VALHALLA_URL||'https://valhalla1.openstreetmap.de')+'/route';const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locations:points.map(p=>({lat:p.lat,lon:p.lng,type:'break'})),costing:'auto',directions_type:'none'})});assert(r.ok);const b=await r.json();assert.equal(b.trip.status,0);return b.trip.summary.time;}
const base=await route([start,end]);await new Promise(r=>setTimeout(r,1200));const via=await route([start,stop,end]);assert(Number.isFinite(via-base));console.log('PASS реальный заезд через Пушкина, 1:',Math.max(0,via-base).toFixed(1),'сек');
