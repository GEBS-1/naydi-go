import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://localhost:3001',out='artifacts/seller-account';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local only');
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();let signed=false,provider='telegram',pending='telegram',identities=[];
 await page.addInitScript(()=>{window.open=()=>null;});
 await page.route('**/api/buyer/auth',r=>{if(r.request().method()==='DELETE'){signed=false;return r.fulfill({json:{ok:true}});}const b=r.request().postDataJSON();if(b.provider){pending=b.provider;if(signed)expect(b.action).toBe('link');return r.fulfill({json:{url:'https://t.me/fixture_bot?start=fixture'}});}signed=true;provider=pending;if(!identities.includes(provider))identities.push(provider);return r.fulfill({json:{authenticated:true}});});
 await page.route('**/api/connect*',r=>r.fulfill({json:{user:signed?{name:'Продавец',provider}:null,providers:{telegram:true,max:true},identities,shop:null}}));
 await page.route('**/api/listings/draft',r=>r.fulfill({json:r.request().method()==='GET'?{draft:null,version:0}:{ok:true,version:1}}));
 await page.goto(base+'/sell');await page.getByRole('button',{name:'Войти через Telegram',exact:true}).click();await expect(page.getByRole('heading',{name:'Разместить объявление',exact:true})).toBeVisible();await page.getByText('Аккаунт и другой способ входа',{exact:true}).click();await page.getByRole('button',{name:'Привязать MAX к этому аккаунту',exact:true}).click();await expect.poll(()=>identities.length).toBe(2);await expect(page.getByText('Вы вошли через MAX.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Выйти из аккаунта',exact:true}).click();await expect(page.getByRole('heading',{name:'Войдите и разместите товар'})).toBeVisible();await page.getByRole('button',{name:'Войти через Telegram',exact:true}).click();await expect(page.getByRole('heading',{name:'Разместить объявление',exact:true})).toBeVisible();await page.getByText('Аккаунт и другой способ входа',{exact:true}).click();await expect(page.getByRole('button',{name:'Привязать MAX к этому аккаунту',exact:true})).toHaveCount(0);
 await page.screenshot({path:out+'/unified-account-'+width+'.png',fullPage:true});report.push({width,messengerLinkSameAccount:true,logoutAndReentry:true,unifiedEntry:true,botConfirmation:'simulated'});await context.close();
}}finally{await browser.close();await writeFile(out+'/browser-report.json',JSON.stringify(report,null,2));}
console.log('PASS',JSON.stringify(report));
