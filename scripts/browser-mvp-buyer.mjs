// Real local search and seller links. Only browser geolocation is simulated.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.QA_BASE||'http://127.0.0.1:3001';
const out='artifacts/mvp-buyer';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:950},geolocation:{latitude:55.763,longitude:49.123},permissions:['geolocation']});
  const page=await context.newPage();
  let searches=0;
  page.on('request',request=>{if(request.url().includes('/api/search')&&request.method()==='POST')searches++;});
  await page.addInitScript(()=>{localStorage.setItem('ng_city','Казань');localStorage.setItem('ng_analytics_consent_v1','no');});
  try{
   await page.goto(base+'/?qa=1');
   await expect(page.getByRole('heading',{name:'Что ищете рядом?'})).toBeVisible();
   await expect(page.getByRole('button',{name:'Рядом с вами · Казань'})).toBeVisible();
   await page.waitForTimeout(400);
   await page.getByRole('textbox',{name:'Что хотите найти?'}).fill('зарядка для ноутбука Lenovo 65 Вт');
   await expect(page.getByRole('textbox',{name:'Что хотите найти?'})).toHaveValue('зарядка для ноутбука Lenovo 65 Вт');
   await page.getByRole('button',{name:'Найти',exact:true}).click();
   const product=page.locator('.nearby-product').filter({hasText:'Lenovo 20V 3.25A'}).first();
   await expect(product).toBeVisible({timeout:30000});
   await expect(product).toContainText('1 200 ₽');
   const image=product.locator('img').first();
   await expect.poll(()=>image.evaluate(node=>node.complete&&node.naturalWidth>0),{timeout:15000}).toBe(true);
   await product.getByRole('button',{name:'Описание и контакты'}).click();
   const seller=product.getByRole('link',{name:'Товар у продавца'});
   await expect(seller).toHaveAttribute('href',/^https:\/\/setup-service\.ru\/shop\//);
   await expect(product.getByRole('link',{name:/239-42-14/})).toHaveAttribute('href',/^tel:/);
   await page.screenshot({path:`${out}/product-${width}.png`,fullPage:true});
   const before=searches;
   await page.locator('.nearby-view').getByRole('link',{name:'Карта',exact:true}).click();
   await expect(page.locator('svg[aria-label="Интерактивная карта магазинов"]')).toBeVisible();
   await expect(page.locator('.nearby-route').first()).toHaveAttribute('href',/^https:/);
   await page.screenshot({path:`${out}/map-${width}.png`,fullPage:true});
   await page.locator('.nearby-view').getByRole('link',{name:'Список',exact:true}).click();
   await expect(product).toBeVisible();
   if(searches!==before)throw Error('List/map switch restarted search');
   report.push({width,product:true,photo:true,price:1200,sellerLink:true,phone:true,map:true,route:true,searches});
  }catch(error){report.push({width,error:String(error)});await page.screenshot({path:`${out}/failure-${width}.png`,fullPage:true});process.exitCode=1;}
  await context.close();
 }
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({checkedAt:new Date().toISOString(),report},null,2));}
console.log(JSON.stringify(report));
