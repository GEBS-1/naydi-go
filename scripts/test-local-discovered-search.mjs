import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {chromium,expect} from '@playwright/test';

const origin=process.argv[2]||'http://127.0.0.1:3000';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Локальный поиск можно проверить только против loopback.');
const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject',file=path.join(folder,readdirSync(folder).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'));
const database=new DatabaseSync(file);database.exec('PRAGMA busy_timeout=5000');
const city='казань',query='Дом и ремонт',now=Date.now(),id='qa-discovered-'+crypto.randomUUID(),source=`https://seller.example/${id}`;
const photonKey='photon:ru:v2:казань:true',box=[55.7,49,55.9,49.2],selectors=['["shop"="doityourself"]','["shop"="hardware"]','["shop"="bathroom_furnishing"]','["shop"="trade"]'].join('|');
const cacheKeys=[photonKey,`osm:v3:казань:${box.map(n=>n.toFixed(3)).join(',')}:${selectors}`,'seller-catalog:v9:казань:https://megakrepezh.ru/krepezh/perforaciya','seller-catalog:v9:казань:https://kazan.tatmetiz.ru/shop/instrument/elektroinstrument/elektroinstrument-akkumulyatornye-shurupoverty/'];
const previousCache=new Map(cacheKeys.map(key=>[key,database.prepare('SELECT data,expires_at FROM search_cache WHERE id=?').get(key)]));
const beforeSearchIds=new Set(database.prepare('SELECT id FROM searches').all().map(row=>row.id)),beforeMetricIds=new Set(database.prepare('SELECT id FROM search_metrics').all().map(row=>row.id));
function cache(key,data){database.prepare('INSERT INTO search_cache(id,data,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').run(key,JSON.stringify(data),now+3600000);}
function cleanup(){
 database.prepare('DELETE FROM discovered_offers WHERE id=?').run(id);
 for(const [key,row] of previousCache){if(row)database.prepare('UPDATE search_cache SET data=?,expires_at=? WHERE id=?').run(row.data,row.expires_at,key);else database.prepare('DELETE FROM search_cache WHERE id=?').run(key);}
 const newSearches=database.prepare('SELECT id FROM searches').all().filter(row=>!beforeSearchIds.has(row.id));for(const row of newSearches)database.prepare('DELETE FROM searches WHERE id=?').run(row.id);
 const newMetrics=database.prepare('SELECT id FROM search_metrics').all().filter(row=>!beforeMetricIds.has(row.id));for(const row of newMetrics)database.prepare('DELETE FROM search_metrics WHERE id=?').run(row.id);
 database.close();
}

const hit={id,kind:'product',title:'QA автомобильный компрессор 12 В — локальный поиск',description:'Временное предложение только для E2E-проверки.',category:'Дом и ремонт',city:'Казань',address:'ул. Тестовая, 1',point:{lat:55.8,lng:49.1},phone:'+7 843 000-00-00',site:'https://seller.example',hours:null,source,checkedAt:new Date(now).toISOString(),price:990,image:'/categories/auto.png',status:'website',distanceKm:null,locationEvidence:'confirmed-point',sourceAvailability:'unknown',seller:'QA продавец'};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 cache(photonKey,[{lat:55.8,lng:49.1,label:'Казань',city:'Казань',extent:[49,55.9,49.2,55.7]}]);
 cache(`osm:v3:казань:${box.map(n=>n.toFixed(3)).join(',')}:${selectors}`,{elements:[],checkedAt:new Date(now).toISOString()});
 cache(cacheKeys[2],[]);cache(cacheKeys[3],[]);
 database.prepare('INSERT INTO discovered_offers(id,city,source_key,source_url,data,checked_at) VALUES(?,?,?,?,?,?)').run(id,city,source,source,JSON.stringify(hit),now);

 const response=await fetch(origin+'/api/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({query,city:'Казань',near:{lat:55.81,lng:49.11}})});
 assert.equal(response.status,200);const phases=(await response.text()).trim().split('\n').map(line=>JSON.parse(line)),final=phases.at(-1);
 const fromIndex=final.hits.find(item=>item.id===id);assert.ok(fromIndex,'the real search endpoint must include a previously discovered local offer');assert.equal(fromIndex.price,990);assert.equal(fromIndex.sourceAvailability,'unknown');assert.ok(fromIndex.distanceKm>0);

 const page=await browser.newPage({viewport:{width:1440,height:980}});await page.addInitScript(()=>localStorage.setItem('ng_city','Казань'));
 await page.route('https://*.tile.openstreetmap.org/**',route=>route.abort());
 await page.goto(origin+'/#search/'+encodeURIComponent(query));
 await expect(page.getByRole('heading',{name:hit.title})).toBeVisible({timeout:20000});
 const card=page.locator('.search-hit').filter({hasText:hit.title});await expect(card.getByText('990 ₽')).toBeVisible();await expect(card.getByText(/QA продавец/)).toBeVisible();await expect(card.getByRole('link',{name:'Маршрут'})).toHaveAttribute('href',/yandex\.ru\/maps/);
 mkdirSync('artifacts/result-cards',{recursive:true});await page.screenshot({path:'artifacts/result-cards/real-local-search-card.png',fullPage:true});
 console.log('PASS: real local /api/search reads the discovered-offer index and renders one unified card with source price, seller, and route.');
 await page.close();
}finally{await browser.close();cleanup();}
