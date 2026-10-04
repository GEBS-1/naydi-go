import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/browser-mobile-final';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),report=[];
try{
 await page.goto('http://localhost:3000/');await page.getByRole('textbox',{name:'Что хотите найти?'}).waitFor();await page.screenshot({path:out+'/home.png'});
 const received=page.waitForResponse(r=>r.url().endsWith('/api/search')&&r.request().method()==='POST',{timeout:90000});
 await page.getByRole('textbox',{name:'Что хотите найти?'}).fill('квантовый телепорт для единорога 987654');await page.getByRole('textbox',{name:'Что хотите найти?'}).press('Enter');
 const response=await received;await response.finished();await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:90000});
 await expect(page.getByRole('heading',{name:'Пока ничего не найдено'})).toBeVisible({timeout:90000});
 await page.screenshot({path:out+'/empty.png'});report.push('Real empty query: no fabricated offers');
 const bounds=await page.evaluate(()=>{const nav=document.querySelector('.d-bottom').getBoundingClientRect(),scroller=document.querySelector('.ng-app>div:has(>.d-main)');scroller.scrollTop=scroller.scrollHeight;return {contentBottom:scroller.getBoundingClientRect().bottom,navTop:nav.top,overflow:document.documentElement.scrollWidth>innerWidth};});
 expect(bounds.contentBottom).toBeLessThanOrEqual(bounds.navTop+1);expect(bounds.overflow).toBe(false);report.push(bounds);await page.screenshot({path:out+'/bottom.png'});
}catch(e){report.push({error:e.message});process.exitCode=1;}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(report);}
