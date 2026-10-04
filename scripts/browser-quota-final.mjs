import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/quota-final';await mkdir(out,{recursive:true});const report=[];
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage();
const remaining=async()=>{const r=await page.request.get('http://localhost:3000/api/buyer/me');const b=await r.json();return b.balance.find(x=>x.kind==='free')?.remaining;};
const search=async query=>{const r=await page.request.post('http://localhost:3000/api/search',{headers:{Origin:'http://localhost:3000'},data:{query,city:'Казань'}});return {status:r.status(),body:await r.json()};};
try{await page.goto('http://localhost:3000/');const me=await page.request.get('http://localhost:3000/api/buyer/me').then(r=>r.json()),start=await remaining(),good=await search('беспроводные наушники'),afterGood=await remaining();expect(good.status).toBe(200);expect(good.body.hits.some(h=>h.kind==='product'&&h.price!==null)).toBeTruthy();if(me.quota)expect(afterGood).toBe(start-1);
 const failed=await search('квантовый телепорт единорога 938402'),afterFailed=await remaining();expect(failed.status).toBe(200);expect(failed.body.chargeable).toBe(false);if(me.quota)expect(afterFailed).toBe(afterGood);report.push({passed:true,quotaEnforced:me.quota,start,afterSuccessfulSearch:afterGood,afterUnavailableEmptySearch:afterFailed,emptyWarnings:failed.body.warnings});
}catch(e){report.push({error:e.message});process.exitCode=1;}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
