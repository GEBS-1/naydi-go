import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/cities';await mkdir(out,{recursive:true});const report=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);
await page.addInitScript(()=>{const original=window.fetch;window.__citySearch=[];window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0])==='/api/search'){const request=JSON.parse(args[1].body);void response.clone().text().then(text=>{const result=text.trim().split('\n').map(JSON.parse).at(-1);window.__citySearch.push({city:request.city,result});}).catch(()=>{});}return response;};});
console.log('Browser ready');
try{
 await page.goto('http://localhost:3000/');
 console.log('Home loaded');
 await expect(page.getByRole('button',{name:'Изменить город'})).toContainText('Выбрать город');
 for(const city of ['Москва','Екатеринбург']){
  console.log('Choosing',city);
  if(!await page.getByLabel('Город',{exact:true}).isVisible())await page.getByRole('button',{name:'Изменить город'}).click();
  await page.getByLabel('Город',{exact:true}).fill(city);await page.getByRole('button',{name:'Выбрать',exact:true}).click();
  await expect(page.getByRole('button',{name:'Изменить город'})).toContainText(city);
  await page.reload();await expect(page.getByRole('button',{name:'Изменить город'})).toContainText(city);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/search')&&r.request().postDataJSON()?.city===city,{timeout:90000});
  await page.getByRole('textbox',{name:'Что хотите найти?'}).fill('изготовление ключей');await page.getByRole('textbox',{name:'Что хотите найти?'}).press('Enter');
  const r=await response;console.log('Search response',city,r.status());await page.waitForFunction(city=>window.__citySearch.some(x=>x.city===city&&x.result.phase==='complete'),city,{timeout:90000});await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:90000});
  const actual=await page.evaluate(city=>window.__citySearch.find(x=>x.city===city&&x.result.phase==='complete').result,city);expect(actual.hits.length).toBeGreaterThan(0);expect(actual.hits.every(h=>h.city===city)).toBeTruthy();report.push({city,total:actual.hits.length,timing:actual.timing,sources:actual.hits.slice(0,3).map(h=>({title:h.title,city:h.city,point:h.point,source:h.source}))});
  await page.screenshot({path:out+'/'+city+'.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:out+'/'+city+'-desktop.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.setViewportSize({width:390,height:844});
  report.push({city,http:r.status(),sentCity:r.request().postDataJSON().city,results:await page.locator('.search-hit').count(),text:(await page.locator('.finder').innerText()).slice(-1400)});
  await page.getByRole('button',{name:'По дороге',exact:true}).click();await expect(page.getByLabel('Откуда вы едете?',{exact:true})).toHaveAttribute('placeholder',city+', улица и дом');
  await page.goto('http://localhost:3000/');
 }
 const response=await page.request.get('http://localhost:3000/api/discovery',{headers:{'cf-ipcity':'Kazan','x-forwarded-for':'8.8.8.8'}});report.push({spoofedIpHeadersIgnored:(await response.json()).city===null});
}catch(e){report.push({error:e.message});process.exitCode=1;await page.screenshot({path:out+'/failure.png'});}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(report);}
