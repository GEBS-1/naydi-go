import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='https://naydigo.prepromo.ru',out='artifacts/launch-check';mkdirSync(out,{recursive:true});
const report={at:new Date().toISOString(),checks:[]};const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:900}}),page=await ctx.newPage();
 await page.addInitScript(()=>{const original=window.fetch;window.__launchResult=null;window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0])==='/api/search')void response.clone().text().then(text=>{window.__launchResult=text;});return response;};});
 const metrika=[];page.on('response',r=>{if(r.url().includes('mc.yandex.ru'))metrika.push({path:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(base+'/account');await expect(page.getByRole('button',{name:'Войти через Яндекс'})).toBeVisible();
 await page.screenshot({path:out+'/account.png',fullPage:true});
 await page.getByRole('button',{name:'Войти через Яндекс'}).click();await page.waitForURL(u=>u.hostname.endsWith('yandex.ru'),{timeout:20000});
 report.checks.push({name:'Yandex redirect',host:new URL(page.url()).hostname,manualAccountConsentRequired:true});await page.screenshot({path:out+'/yandex.png',fullPage:true});
 await page.goto(base);const input=page.getByRole('textbox',{name:'Что хотите найти?'});await input.waitFor();
 await page.getByLabel('Город',{exact:true}).fill('Казань');await page.getByRole('button',{name:'Выбрать',exact:true}).click();
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/search'&&r.request().method()==='POST',{timeout:120000});
 const started=Date.now();await input.fill('беспроводные наушники');await input.press('Enter');const r=await response;
 await page.waitForFunction(()=>window.__launchResult!==null,{},{timeout:120000});const raw=await page.evaluate(()=>window.__launchResult);let b;try{b=JSON.parse(raw);}catch{b=raw.trim().split('\n').map(x=>JSON.parse(x)).at(-1);}
 report.checks.push({name:'Search',status:r.status(),ms:Date.now()-started,hits:b.hits?.length,products:b.hits?.filter(x=>x.kind==='product').slice(0,5).map(x=>({title:x.title,price:x.price,source:x.source})),usage:b.usage,error:b.error});
 await page.screenshot({path:out+'/search-390.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:out+'/search-1440.png',fullPage:true});
 const jstart=Date.now();const j=await ctx.request.post(base+'/api/journey',{headers:{Origin:base},data:{query:'цветы',city:'Казань',start:{lat:55.7963,lng:49.1088},end:{lat:55.855,lng:49.227},mode:'auto'},timeout:120000});const jb=await j.json();
 report.checks.push({name:'Journey Kazan-Derbyshki',status:j.status(),ms:Date.now()-jstart,points:jb.route?.points?.length,stores:jb.results?.length,usage:jb.usage,error:jb.error,warnings:jb.warnings});
 const geo=await ctx.request.post(base+'/api/location',{headers:{Origin:base},data:{lat:55.7963,lng:49.1088},timeout:20000});report.checks.push({name:'City from supplied Kazan coordinates (not real user GPS)',status:geo.status(),result:await geo.json()});
 const discovery=await ctx.request.get(base+'/api/discovery');report.checks.push({name:'IP city',result:await discovery.json()});
 report.metrika=metrika;await ctx.close();
}catch(e){report.error=e.message;process.exitCode=1;}finally{await browser.close();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
