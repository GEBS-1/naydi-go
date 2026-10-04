import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://localhost:3000',out='artifacts/local-catalogs';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try{
 for(const scenario of [{query:'Дом и ремонт',name:'home-repair'},{query:'Автотовары',name:'auto'},{query:'Спорт и хобби',name:'sport'},{query:'Электроника',name:'electronics'},{query:'Сад и дача',name:'garden'},{query:'Зоотовары',name:'pets'},{query:'сверло по бетону',name:'concrete-drill'},{query:'корейская косметика',name:'korean-cosmetics'}])for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:1000}});page.setDefaultTimeout(120000);
  await page.addInitScript(()=>localStorage.setItem('ng_city','Казань'));
  await page.goto(base+'/#search/'+encodeURIComponent(scenario.query),{waitUntil:'domcontentloaded'});
  await page.locator('html[data-naydi-hydrated="true"]').waitFor();
  await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:120000});
  const products=page.locator('.search-hit').filter({hasText:'Товар'});await expect(products.first()).toBeVisible();
  for(let i=0;i<Math.min(4,await products.count());i++){await products.nth(i).scrollIntoViewIfNeeded();await page.waitForFunction(node=>{const image=node.querySelector('.search-hit-image img');return !!image&&image.complete;},await products.nth(i).elementHandle());}
  const rows=await products.evaluateAll(nodes=>nodes.slice(0,4).map(node=>{const image=node.querySelector('.search-hit-image img');return {title:node.querySelector('h2')?.textContent?.trim(),price:node.querySelector('strong')?.textContent?.trim(),seller:[...node.querySelectorAll('p')].find(p=>p.textContent?.includes('Продавец'))?.textContent?.trim(),image:image?.getAttribute('src'),loaded:!!image&&image.naturalWidth>0,fallback:!!node.querySelector('.branded-fallback')};}));
  const sourceImages=rows.filter(row=>row.loaded&&!row.fallback).length;
  if(!rows.length||sourceImages<Math.min(3,rows.length))throw Error(`${scenario.query}/${width}: insufficient source images ${JSON.stringify(rows)}`);
  await products.first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${scenario.name}-${width}.png`});
  report.push({query:scenario.query,width,products:await products.count(),rows});await page.close();
 }
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
