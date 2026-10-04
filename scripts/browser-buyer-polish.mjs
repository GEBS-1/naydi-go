import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/buyer-polish';await mkdir(out,{recursive:true});const report=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});let searches=0,polls=0;
 page.on('request',r=>{if(r.url().endsWith('/api/search')&&r.method()==='POST')searches++;if(r.url().endsWith('/api/buyer/auth')&&r.postData()?.includes('status'))polls++;});
 await page.goto('http://localhost:3000/');await page.getByRole('button',{name:'Изменить город'}).click();await page.getByLabel('Город',{exact:true}).fill('Самара');await page.getByRole('button',{name:'Выбрать',exact:true}).click();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/search'));
 const input=page.getByRole('textbox',{name:'Что хотите найти?'});await input.fill('беспроводные наушники');await input.press('Enter');await (await response).finished();await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:90000});
 await expect(page.locator('.search-hit').first()).toContainText('₽');await expect(page.locator('.search-hit').first()).toContainText('Продавец / сайт');
  const count=searches;await page.locator('.finder-results-toolbar').getByRole('link',{name:'Карта',exact:true}).click();await expect(page).toHaveURL(/#map/);await page.locator('.finder-results-toolbar').getByRole('link',{name:'Список',exact:true}).click();await page.waitForTimeout(1500);expect(searches).toBe(count);
 await page.screenshot({path:`${out}/search-${width}.png`});
 await page.goto('http://localhost:3000/account');await expect(page.getByRole('heading',{name:'Free',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Pro — 149 ₽'})).toBeVisible();await page.waitForTimeout(3000);expect(polls).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`${out}/account-${width}.png`});
 report.push({width,passed:true,searchRequests:searches,unsolicitedBotPolls:polls,scope:'Real UI/API, no network mocks; real priced product visible; map toggle reuses current results; Free/Pro shown.'});await page.close();
}}catch(e){report.push({error:e.message});process.exitCode=1;}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
