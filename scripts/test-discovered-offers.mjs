import assert from 'node:assert/strict';
import {build} from 'esbuild';

const output=await build({entryPoints:['lib/discovered-offer-contract.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22'});
const {discoveredSourceKey,persistableDiscoveredOffer,selectDiscoveredOffers,DISCOVERED_OFFER_MAX_AGE_MS}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const now=Date.now();
const base={id:'offer-1',kind:'product',title:'Свечной ключ 16 мм',description:'Инструмент для замены свечей',category:'Автоинструмент',city:'Казань',address:'ул. Тестовая, 1',point:{lat:55.8,lng:49.1},phone:'+7 843 000-00-00',site:'https://seller.example',hours:null,source:'https://seller.example/product/key?utm_source=test',checkedAt:new Date(now).toISOString(),price:650,image:'https://seller.example/key.jpg',status:'website',distanceKm:null,locationEvidence:'confirmed-point',sourceAvailability:'unknown',seller:'Магазин инструментов'};
assert.equal(discoveredSourceKey('https://seller.example/product/key?utm_source=test'),'https://seller.example/product/key');
assert.equal(persistableDiscoveredOffer(base,'Казань'),true);
assert.equal(persistableDiscoveredOffer({...base,point:null},'Казань'),false,'offers without a verified map point are not added to the nearby index');
assert.equal(persistableDiscoveredOffer({...base,point:{lat:91,lng:49.1}},'Казань'),false,'invalid coordinates cannot be persisted as nearby locations');
assert.equal(persistableDiscoveredOffer({...base,locationEvidence:'unverified'},'Казань'),false);
assert.equal(persistableDiscoveredOffer({...base,site:'https://makpets.ru/product/food',source:'https://makpets.ru/product/food'},'Казань'),false,'a postal address must not be converted into a nearby retail point');
assert.equal(persistableDiscoveredOffer({...base,city:'Самара'},'Казань'),false,'city data cannot cross city indexes');
const near={lat:55.81,lng:49.11};
const selected=selectDiscoveredOffers([base,{...base,id:'stale',checkedAt:new Date(now-DISCOVERED_OFFER_MAX_AGE_MS-1).toISOString()},{...base,id:'foreign',city:'Самара'}],'свечной ключ 16 мм','Казань',near,now);
assert.equal(selected.length,1);assert.equal(selected[0].id,'offer-1');assert.ok(selected[0].distanceKm>0);
assert.equal(selected[0].sourceAvailability,'unknown','persisted public offers never become confirmed stock');
assert.equal(selected[0].price,650,'source price is retained as an observed value');
assert.equal(selectDiscoveredOffers([{...base,id:'old-makpets',site:'https://makpets.ru/product/food',source:'https://makpets.ru/product/food'}],'свечной ключ 16 мм','Казань',near,now).length,0,'old cached postal addresses from Makpets are not reused as nearby offers');
console.log('PASS: verified local offers are reusable for 24h, deduplicated, city-isolated, distance-refreshed, and stock remains unconfirmed.');

const dbRows=[];
globalThis.__discoveredDb={
 prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async all(){const [city,since]=this.args;return {results:dbRows.filter(row=>row.city===city&&row.checked_at>=since).sort((a,b)=>b.checked_at-a.checked_at).slice(0,500).map(row=>({data:row.data}))};},async run(){const a=this.args;if(this.sql.startsWith('INSERT INTO discovered_offers')){const existing=dbRows.find(row=>row.city===a[1]&&row.source_key===a[2]);const row={id:a[0],city:a[1],source_key:a[2],source_url:a[3],data:a[4],checked_at:a[5]};if(existing)Object.assign(existing,{source_url:row.source_url,data:row.data,checked_at:row.checked_at});else dbRows.push(row);return;}if(this.sql.startsWith('DELETE FROM discovered_offers')){for(let i=dbRows.length-1;i>=0;i--)if(dbRows[i].checked_at<a[0])dbRows.splice(i,1);return;}throw new Error('Unexpected SQL in fake D1: '+this.sql);}};},
 async batch(statements){for(const statement of statements)await statement.run();},
};
const runtime=await build({entryPoints:['lib/discovered-offers.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22',alias:{'@/db':'./db/index.ts'},plugins:[{name:'mock-cloudflare-env',setup(buildApi){buildApi.onResolve({filter:/^@\/lib\/server-env$/},()=>({path:'mock-env',namespace:'mock'}));buildApi.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env={DB:globalThis.__discoveredDb};',loader:'js'}));}}]});
const {persistDiscoveredOffers,readDiscoveredOffers}=await import('data:text/javascript;base64,'+Buffer.from(runtime.outputFiles[0].text).toString('base64'));
assert.equal(await persistDiscoveredOffers('Казань',[base]),1);assert.equal(dbRows.length,1);
const fetched=await readDiscoveredOffers('Казань','свечной ключ 16 мм',near);assert.equal(fetched.length,1);assert.ok(fetched[0].distanceKm>0);
assert.equal(await persistDiscoveredOffers('Казань',[{...base,price:720,source:'https://seller.example/product/key?yclid=123'}]),1);
assert.equal(dbRows.length,1,'the same source product updates in place instead of creating duplicate cards');
assert.equal(JSON.parse(dbRows[0].data).price,720);
const staleVeloskyBranch={...base,id:'velosky-bike',title:'Детский велосипед Novatrack Twist 14',category:'Спорт и хобби',site:'https://velosky.ru/catalog/detskiy-velosiped',source:'https://velosky.ru/catalog/detskiy-velosiped',address:'ул. Маршала Чуйкова, 93, Казань',point:{lat:55.8362836,lng:49.1573532},phone:'+7 843 250-90-96',price:7290,seller:'Velosky'};
assert.equal(await persistDiscoveredOffers('Казань',[staleVeloskyBranch]),1);
const victoryPoint={lat:55.7688498,lng:49.2208479};
const fromVictory=await readDiscoveredOffers('Казань','велосипед Novatrack',victoryPoint);
assert.equal(fromVictory.length,1);
assert.equal(fromVictory[0].address,'проспект Победы, 100, Казань','cached product must be rebound to the nearest verified Velosky branch for the current user');
assert.deepEqual(fromVictory[0].point,victoryPoint);
assert.equal(fromVictory[0].distanceKm,0);
const fromChuykova=await readDiscoveredOffers('Казань','велосипед Novatrack',{lat:55.8362836,lng:49.1573532});
assert.equal(fromChuykova[0].address,'ул. Маршала Чуйкова, 93, Казань','the same cached product must switch to the other branch from another location');
console.log('PASS: discovery storage upserts by canonical source URL and reads through the D1 adapter without changing seller stock state.');
