import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/search-production',base=process.env.QA_BASE||'http://localhost:3000';await mkdir(out,{recursive:true});const report=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(20000);let requests=0;
 page.on('request',r=>{if(r.url().endsWith('/api/search')&&r.method()==='POST')requests++;});
 try{await page.goto(base+'/');await page.getByRole('button',{name:'Изменить город'}).click();await page.getByLabel('Город',{exact:true}).fill('Казань');await page.getByRole('button',{name:'Выбрать',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Что хотите найти?'});await input.fill('беспроводные наушники');await input.press('Enter');
  await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:60000});await expect(page.locator('.search-hit').first()).toBeVisible();
  const first=page.locator('.search-hit').first(),text=await first.innerText();expect(text).toContain('₽');expect(text).toContain('Продавец / сайт');expect(await first.locator('a').filter({hasText:'Источник'}).first().getAttribute('href')).toMatch(/^https:/);
  const before=requests;await page.locator('.finder-results-toolbar').getByRole('link',{name:'Карта',exact:true}).click();await page.waitForTimeout(1200);await page.locator('.finder-results-toolbar').getByRole('link',{name:'Список',exact:true}).click();await page.waitForTimeout(1200);expect(requests).toBe(before);
  await page.screenshot({path:`${out}/products-${width}.png`,fullPage:true});report.push({width,passed:true,requests,firstCard:text.slice(0,500)});
 }catch(e){report.push({width,error:e.message,requests});await page.screenshot({path:`${out}/failure-${width}.png`,fullPage:true});process.exitCode=1;}finally{await page.close();}}
await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
