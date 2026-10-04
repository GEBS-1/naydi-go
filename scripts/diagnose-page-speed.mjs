import {chromium} from '@playwright/test';

const base=process.argv[2]||'http://localhost:3000';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const started=performance.now(),requests=new Map(),slow=[];
page.on('request',r=>requests.set(r,{url:r.url(),type:r.resourceType(),at:performance.now()}));
page.on('requestfinished',async r=>{const item=requests.get(r);if(!item)return;const ms=performance.now()-item.at;if(ms>300)slow.push({...item,ms:Math.round(ms)});});
page.on('requestfailed',r=>slow.push({url:r.url(),type:r.resourceType(),ms:-1,error:r.failure()?.errorText}));
await page.goto(base,{waitUntil:'domcontentloaded'});
const dom=Math.round(performance.now()-started);
await page.locator('.finder-categories button').first().waitFor({state:'visible',timeout:120000});
const interactive=Math.round(performance.now()-started);
const nav=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return n&&{responseStart:Math.round(n.responseStart),domContentLoaded:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),transferSize:n.transferSize};});
console.log(JSON.stringify({dom,interactive,nav,slow:slow.sort((a,b)=>b.ms-a.ms).slice(0,30)},null,2));
await browser.close();
