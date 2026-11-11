import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const origin=process.env.NAYDIGO_TEST_ORIGIN||'http://localhost:3000';
const query=process.env.NAYDIGO_TEST_QUERY||'катушка зажигания Geely Tugella';
const city=process.env.NAYDIGO_TEST_CITY||'Казань';
const near=JSON.parse(process.env.NAYDIGO_TEST_NEAR||'{"lat":55.7961,"lng":49.1064}');
const viewportWidth=Number(process.env.NAYDIGO_TEST_WIDTH||1440);
const output='artifacts/combined-search/'+createHash('sha256').update(query).digest('hex').slice(0,10)+'-'+viewportWidth;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:viewportWidth,height:1000},geolocation:{latitude:near.lat,longitude:near.lng},permissions:['geolocation']});
const page=await context.newPage();
const errors=[];
const mapNetwork=[];
const productImageNetwork=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('requestfailed',request=>{if(request.url().includes('tile.openstreetmap.org'))mapNetwork.push({url:request.url(),error:request.failure()?.errorText});});
page.on('response',response=>{if(response.url().includes('tile.openstreetmap.org'))mapNetwork.push({url:response.url(),status:response.status(),contentType:response.headers()['content-type'],contentLength:response.headers()['content-length']});else if(/\.(?:png|jpe?g|webp)(?:\?|$)/i.test(response.url()))productImageNetwork.push({url:response.url(),status:response.status(),contentType:response.headers()['content-type']});});
await page.addInitScript(()=>{
 localStorage.setItem('ng_city','Казань');
 localStorage.setItem('ng_geo_choice','yes');
 window.__qaPhases=[];
 const original=window.fetch.bind(window);
 window.fetch=async(...args)=>{
  const response=await original(...args);
  if(String(args[0]).endsWith('/api/search')&&response.headers.get('content-type')?.includes('application/x-ndjson')){
   void response.clone().text().then(body=>{for(const line of body.trim().split('\n')){try{const phase=JSON.parse(line);window.__qaPhases.push({phase:phase.phase,sources:phase.sources,hitCount:phase.hits?.length||0,productCount:phase.hits?.filter(hit=>hit.kind==='product').length||0,atMs:Math.round(performance.now()-(window.__qaUiStart||window.__qaStart))});}catch{}}}).catch(()=>{});
  }
  return response;
 };
 window.__qaStart=performance.now();
});
await page.goto(origin,{waitUntil:'domcontentloaded'});
const started=Date.now();
const response=await page.evaluate(async({query,city,near})=>{
 const start=performance.now();
 const res=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:JSON.stringify({query,city,near})});
 const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';const phases=[];
 while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines){if(!line.trim())continue;const result=JSON.parse(line);phases.push({atMs:Math.round(performance.now()-start),phase:result.phase,sources:result.sources,usage:result.usage,warnings:result.warnings,hits:(result.hits||[]).map(hit=>({kind:hit.kind,title:hit.title,price:hit.price,source:hit.source,image:hit.image,seller:hit.seller,address:hit.address,point:hit.point,distanceKm:hit.distanceKm,status:hit.status,locationEvidence:hit.locationEvidence,sourceAvailability:hit.sourceAvailability}))});}}
 return {http:res.status,phases};
},{query,city,near});
await page.screenshot({path:`${output}/search.png`,fullPage:true});
await writeFile(`${output}/api-report.json`,JSON.stringify({createdAt:new Date().toISOString(),origin,query,city,near,elapsedMs:Date.now()-started,...response},null,2));
const uiStarted=Date.now();
await page.evaluate(()=>{window.__qaPhases=[];window.__qaUiStart=performance.now();});
const textbox=page.getByRole('textbox',{name:'Что хотите найти?'});
await textbox.fill(query);await textbox.press('Enter');
const continueWithoutGeo=page.getByRole('button',{name:'Продолжить без геолокации'});await continueWithoutGeo.waitFor({state:'visible',timeout:2500}).then(()=>continueWithoutGeo.click()).catch(()=>{});
let uiFirstProductMs=null;try{await page.locator('.search-hit-product').first().waitFor({timeout:8000});uiFirstProductMs=Date.now()-uiStarted;}catch{}
await page.waitForFunction(()=>window.__qaPhases.length>0&&window.__qaPhases.at(-1).phase==='complete',undefined,{timeout:30000});
await page.waitForFunction(()=>[...document.querySelectorAll('.search-hit-image-source')].some(image=>image.complete&&image.naturalWidth>0),undefined,{timeout:10000}).catch(()=>{});
await page.screenshot({path:`${output}/results-browser.png`,fullPage:true});
const uiCards=await page.locator('.search-hit-product').evaluateAll(cards=>cards.map(card=>({title:card.querySelector('.search-hit-title')?.textContent?.trim(),price:card.querySelector('.search-hit-price')?.textContent?.trim(),address:card.querySelector('.search-hit-address')?.textContent?.trim(),image:card.querySelector('.search-hit-image-source')?.getAttribute('src')||null,imageLoaded:card.querySelector('.search-hit-image-source')?.naturalWidth>0,actions:[...card.querySelectorAll('.search-hit-actions a')].map(link=>({text:link.textContent?.trim(),href:link.href}))})));
let sellerOpensNewTab=null;
let sellerNavigation=null;
const sellerLink=page.locator('.search-hit-product .search-hit-primary[target="_blank"]').first();
if(await sellerLink.count()){
 const before=page.url(),href=await sellerLink.getAttribute('href'),target=await sellerLink.getAttribute('target');
 const popupPromise=context.waitForEvent('page',{timeout:5000}).catch(()=>null);
 await sellerLink.click();
 const popup=await popupPromise;sellerOpensNewTab=!!popup&&popup!==page&&page.url().includes('#search/');sellerNavigation={before,after:page.url(),href,target,pages:context.pages().map(p=>p.url())};if(popup)await popup.close();
}
if(/катушка зажигания Geely Tugella/i.test(query)&&!uiCards.some(card=>card.title?.includes('Катушка зажигания Geely Tugella')&&card.price?.includes('1 700')))throw new Error('The buyer UI did not render the verified local catalog offer.');
if(uiCards.some(card=>/default_part|no[-_]?image|no[-_]?photo|placeholder|blank/i.test(card.image||'')))throw new Error('The buyer UI presented a generic no-photo placeholder as a product photograph.');
if(uiCards.some(card=>!card.address&&card.actions.some(action=>action.text?.includes('Маршрут'))))throw new Error('A result without a verified seller address unexpectedly received a route action.');
await page.getByRole('link',{name:'Карта',exact:true}).first().click();
const mapVisible=await page.locator('svg[aria-label="Интерактивная карта магазинов"]').waitFor({timeout:5000}).then(()=>true).catch(()=>false);
const marker=page.getByRole('button',{name:/^Показать /}).first();
 const hasMarker=mapVisible&&await marker.count()>0;if(hasMarker)await marker.evaluate(element=>element.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})));
const mapRoute=hasMarker?await page.locator('.finder-map-card a.finder-primary').getAttribute('href',{timeout:1000}).catch(()=>null):null;
const mapDimensions=mapVisible?await page.locator('.finder-map').evaluate(map=>({container:map.getBoundingClientRect().height,svg:map.querySelector('svg')?.getBoundingClientRect().height||0})):null;
if(mapDimensions&&mapDimensions.svg<mapDimensions.container-1)throw new Error('The map tiles do not fill the map viewport.');
if(hasMarker&&mapRoute&&!mapRoute.startsWith('https://yandex.ru/maps/'))throw new Error('The selected map point did not offer a Yandex route.');
const svgTiles=await page.locator('.finder-map svg image').evaluateAll(images=>images.map(image=>({href:image.getAttribute('href'),x:image.getAttribute('x'),y:image.getAttribute('y'),width:image.getAttribute('width'),height:image.getAttribute('height')})));
await page.waitForTimeout(1000);
await page.screenshot({path:`${output}/map-browser.png`,fullPage:true});
const uiPhases=await page.evaluate(()=>window.__qaPhases);
const report={createdAt:new Date().toISOString(),origin,query,city,near,elapsedMs:Date.now()-started,...response,ui:{firstProductMs:uiFirstProductMs,productCards:uiCards,phases:uiPhases,sellerOpensNewTab,sellerNavigation},map:{visible:mapVisible,markers:await page.getByRole('button',{name:/^Показать /}).count(),route:mapRoute,dimensions:mapDimensions,svgTiles,tileRequests:mapNetwork},productImageRequests:productImageNetwork,pageErrors:errors};
await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
