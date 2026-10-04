import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://localhost:3000',out='artifacts/electronics';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(120000);
await page.addInitScript(()=>localStorage.setItem('ng_city','Казань'));
await page.goto(base,{waitUntil:'domcontentloaded'});
await page.locator('html[data-naydi-hydrated="true"]').waitFor({state:'attached',timeout:120000});
await page.getByRole('link',{name:/Электроника/}).click();
await expect(page.locator('.search-hit').first()).toContainText('Товар',{timeout:120000});
const cards=page.locator('.search-hit');
for(let index=0;index<Math.min(5,await cards.count());index++){
 await cards.nth(index).scrollIntoViewIfNeeded();
 await page.waitForFunction(node=>{const image=node.querySelector('img');return !!image&&image.complete;},await cards.nth(index).elementHandle(),{timeout:30000});
}
const report=await cards.evaluateAll(nodes=>nodes.slice(0,5).map(node=>{const image=node.querySelector('img');return {title:node.querySelector('h2')?.textContent,price:node.querySelector('strong')?.textContent,image:image?.src,loaded:!!image&&image.complete&&image.naturalWidth>0,fallback:node.querySelector('.branded-fallback')!==null};}));
if(!report.length||report.some(card=>!card.loaded||card.fallback))throw Error('Товарные изображения не загрузились: '+JSON.stringify(report));
await cards.first().scrollIntoViewIfNeeded();
await page.screenshot({path:out+'/electronics-390.png'});
await writeFile(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
