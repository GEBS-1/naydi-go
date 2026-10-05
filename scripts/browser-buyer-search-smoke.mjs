import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://localhost:3000',query=process.argv[3]||'дрель Makita в Казани',out='artifacts/buyer-search-smoke';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(30000);
  await page.addInitScript(()=>localStorage.setItem('ng_city','Казань'));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-naydi-hydrated','true',{timeout:30000});
  await expect(page.locator('.finder-category-link')).toHaveCount(6,{timeout:30000});
  expect(await page.locator('.finder-modes').count()).toBe(0);
  await page.screenshot({path:`${out}/home-${width}.png`,fullPage:true});
  const input=page.getByRole('textbox',{name:'Что хотите найти?'});await input.fill(query);await expect(input).toHaveValue(query);await page.waitForTimeout(100);await page.getByRole('button',{name:'Найти',exact:true}).click();await expect(page).toHaveURL(/#search\//,{timeout:10000});
  await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:120000});
  await expect(page.locator('.search-hit').first()).toBeVisible({timeout:120000});
  const cards=await page.locator('.search-hit').evaluateAll(nodes=>nodes.slice(0,8).map(node=>({text:(node.textContent||'').replace(/\s+/g,' ').trim(),image:!!node.querySelector('img'),route:[...node.querySelectorAll('a')].some(a=>/Маршрут/.test(a.textContent||''))})));
  await page.screenshot({path:`${out}/search-${width}.png`,fullPage:true});
  report.push({width,query,cards,errors,legacyModeButtons:await page.locator('.finder-modes').count()});
  await page.close();
 }
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
