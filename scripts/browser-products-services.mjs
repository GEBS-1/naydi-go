import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.argv[2]||'http://localhost:3000';
const out='artifacts/cards-images';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try{
 for(const scenario of [
  {name:'product',query:'аккумулятор Toyota RAV4 2017 в Казани',tab:'Товары',marker:'Товар'},
  {name:'service',query:'изготовление ключей в Казани',tab:'Услуги',marker:'Услуга / мастерская'},
 ]){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(120000);
  await page.addInitScript(()=>localStorage.setItem('ng_city','Казань'));
  await page.goto(base+'/#search/'+encodeURIComponent(scenario.query),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:120000});
  await expect(page.locator('.search-hit').first()).toBeVisible({timeout:120000});
  await page.getByRole('button',{name:scenario.tab,exact:true}).click();
  await expect(page.locator('.search-hit').first()).toContainText(scenario.marker);
  const cards=page.locator('.search-hit');
  const count=await cards.count(),images=await cards.locator('.search-hit-image img').count();
  if(images!==count)throw Error(`${scenario.name}: ${images} images for ${count} cards`);
  const real=await cards.locator('.search-hit-image:not(.branded-fallback) img').count();
  await page.screenshot({path:`${out}/${scenario.name}-390.png`,fullPage:true});
  report.push({scenario:scenario.name,query:scenario.query,cards:count,images,realSourceImages:real,brandedFallbacks:count-real});
  await page.close();
 }
}finally{
 await browser.close();
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report,null,2));
