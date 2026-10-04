import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/browser-acceptance',origin='http://localhost:3000';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=window.fetch;window.__qaSearch=[];window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0])==='/api/search')void response.clone().text().then(text=>{try{const b=text.trim().split('\n').map(JSON.parse).at(-1);if(b.phase==='complete')window.__qaSearch.push(b);}catch{}}).catch(()=>{});return response;};});
 const shot=async name=>page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:false});
 async function search(query,label){const start=performance.now();await page.evaluate(()=>{window.__qaSearch=[];});const response=page.waitForResponse(r=>r.url().endsWith('/api/search')&&r.request().method()==='POST',{timeout:120000});await page.getByRole('textbox',{name:'Что хотите найти?'}).fill(query);await page.getByRole('textbox',{name:'Что хотите найти?'}).press('Enter');const r=await response;await page.waitForFunction(()=>window.__qaSearch?.length>0,{},{timeout:120000});const body=await page.evaluate(()=>window.__qaSearch.at(-1));await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:120000});await shot(label);report.push({label,width,ms:Math.round(performance.now()-start),http:r.status(),context:body.context,products:body.hits?.filter(h=>h.kind==='product').map(h=>({title:h.title,price:h.price,source:h.source,seller:h.seller,point:h.point})),usage:body.usage,warnings:body.warnings});await save();return body;}
 async function save(){await writeFile(out+'/search-report.json',JSON.stringify(report,null,2));}
 try{
  await page.goto(origin,{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'Что хотите найти?'}).waitFor({timeout:60000});await shot('home');
  const first=await search('беспроводные наушники','products');expect(first.hits.some(h=>h.kind==='product'&&h.price!==null)).toBeTruthy();await expect(page.locator('.search-hit').first()).toContainText('Источник');await expect(page.locator('.search-hit').first()).toContainText('наличие');
  const refined=await search('покажи дешевле','refinement');expect(refined.context.query).toMatch(/наушник/iu);expect(refined.context.sort).toBe('price');
  await page.getByRole('link',{name:'Карта',exact:true}).first().click();await page.locator('svg[aria-label="Магазины и услуги на карте"]').waitFor({timeout:60000});const markers=page.getByRole('button',{name:/^Показать /});expect(await markers.count()).toBeGreaterThan(0);await markers.first().click();await expect(page.locator('.finder-map-card')).toBeVisible();expect(await page.locator('.finder-map-card a').last().getAttribute('href')).toContain('yandex.ru/maps');await shot('map');report.push({label:'map selection and navigation link',width,passed:true});
  await page.goto(origin);await page.getByRole('button',{name:'Рядом со мной',exact:true}).click();await page.getByRole('button',{name:'Разрешить определение'}).click();await expect(page.getByText('Геолокация недоступна. Укажите адрес или район.',{exact:true})).toBeVisible({timeout:15000});await shot('geo-denied');report.push({label:'geolocation refusal, manual fallback',width,passed:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 }catch(e){report.push({width,error:e.message});await shot('failure');console.error(width,e.message);}finally{report.push({width,pageErrors:errors});await save();await context.close();}
}
await browser.close();console.log(JSON.stringify(report.map(({products,...r})=>({...r,products:products?.length})),null,2));
