// Read-only production UI/API checks, plus one ordinary search. No sign-in or listing submitted.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://naydigo.prepromo.ru',out='artifacts/production-unified';
await mkdir(out,{recursive:true});const report={checkedAt:new Date().toISOString(),pages:[],search:null};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();
  const response=await page.goto(base+'/sell?qa=1',{timeout:60000});assert.equal(response.status(),200);
  await expect(page.getByRole('heading',{name:'Войдите и разместите товар'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Войти через Telegram',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Войти через MAX',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Проверить локально без бота',exact:true})).toHaveCount(0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:out+'/seller-'+width+'.png',fullPage:true});report.pages.push({width,seller:200,telegramButton:true,maxButton:true,noDemoLogin:true});
  for(const path of ['/connect','/business-demo']){await page.goto(base+path);await expect(page).toHaveURL(base+'/sell');}
  const dev=await context.request.post(base+'/api/dev/seller-session',{headers:{Origin:base}});assert.equal(dev.status(),404);
  const draft=await context.request.get(base+'/api/listings/draft');assert.equal(draft.status(),401);
  const assist=await context.request.post(base+'/api/listings/assist',{headers:{Origin:base},data:{}});assert.equal(assist.status(),401);
  await page.goto(base+'/?qa=1');await expect(page.getByRole('heading',{name:'Что ищете рядом?'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Что хотите найти?'})).toBeVisible();
  if(width===1440){
   const r=await context.request.post(base+'/api/search?qa=1',{headers:{Origin:base},data:{query:'набор гаечных ключей',city:'Казань',near:{lat:55.7963,lng:49.1088}},timeout:120000});assert.equal(r.status(),200);const b=await r.json();assert.equal(b.phase,'complete');assert.ok(Array.isArray(b.hits));
   report.search={http:r.status(),phase:b.phase,total:b.hits.length,mappable:b.hits.filter(h=>h.point&&h.address&&h.locationEvidence==='confirmed-point').length,withPhotos:b.hits.filter(h=>h.image).length,sources:b.sources,warnings:b.warnings};assert.ok(b.hits.length>0,'Live search returned no results');
  }
  await context.close();
 }
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
