import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const origin=process.env.QA_BASE||'http://localhost:3000';
const out=process.env.QA_OUT||'artifacts/conversational-search';
const queries=[
 'Найди мне инструмент, чтобы самостоятельно поменять свечи на Toyota RAV4 2017 года. Мне нужен свечной ключ или свечная головка, и таже сами свечи подбери мне',
 'Нужен недорогой инструмент, чтобы просверлить бетонную стену дома',
 'Что купить, чтобы быстро накачать колёса машины в дороге?',
 'Подбери беспроводные наушники для звонков и музыки до 5000 рублей',
 'Нужна лампа, чтобы читать вечером за письменным столом',
 'Хочу ездить по городу и парку, подбери недорогой велосипед'
];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.addInitScript(()=>{localStorage.setItem('ng_city','Казань');const original=window.fetch;window.__qaSearch=[];window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0])==='/api/search')void response.clone().text().then(text=>{try{window.__qaSearch=text.trim().split('\n').map(JSON.parse).filter(x=>x.phase==='complete');}catch{}});return response;};});
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});
 const field=page.getByRole('textbox',{name:'Что хотите найти?'});await field.waitFor();
 await page.getByRole('button',{name:/Изменить город/}).waitFor({timeout:15000});
 await field.fill(queries[0]);
 const dimensions=await field.evaluate(e=>({tag:e.tagName,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,value:e.value}));
 await page.screenshot({path:`${out}/long-query-${width}.png`,fullPage:true});
 const runQueries=width===390?queries:queries.slice(0,1);
 if(runQueries.length){
  for(let i=0;i<runQueries.length;i++){
   await page.evaluate(()=>{window.__qaSearch=[];});const wait=page.waitForResponse(r=>r.url().endsWith('/api/search')&&r.request().method()==='POST',{timeout:120000});
   await field.fill(runQueries[i]);await field.press('Enter');const response=await wait;await response.finished();
   await page.locator('.finder-waiting').waitFor({state:'detached',timeout:120000}).catch(()=>{});
   await page.waitForFunction(()=>window.__qaSearch?.length>0,null,{timeout:120000}).catch(()=>{});const body=await page.evaluate(()=>window.__qaSearch?.at(-1)||null);
   const rows=(body?.hits||[]).map(h=>({kind:h.kind,title:h.title,price:h.price,seller:h.seller||h.shop?.name||null,source:h.source,address:h.address,point:h.point,status:h.status}));
   const routeUrls=await page.locator('a[href^="https://yandex.ru/maps/"]').evaluateAll(nodes=>nodes.map(node=>node.href));
   const visibleTitles=await page.locator('.search-hit h2').allTextContents();
   report.push({width,query:runQueries[i],http:response.status(),understood:body?.context?.query,question:body?.warnings?.find(w=>/укажите|уточн|куда|возраст/i.test(w))||null,products:rows.filter(h=>h.kind==='product'),articles:rows.filter(h=>h.kind==='page'&&/как|инструк|замен|обзор/i.test(h.title)),locations:rows.filter(h=>h.point),visibleTitles,routeUrls,sources:body?.sources,usage:body?.usage,warnings:body?.warnings});
   const firstCard=page.locator('.search-hit').first();if(await firstCard.count()){await firstCard.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/result-${i+1}-${width}.png`});}else await page.screenshot({path:`${out}/result-${i+1}-${width}.png`,fullPage:true});
  }
 }
 report.push({width,textarea:dimensions});await page.close();
}
await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
