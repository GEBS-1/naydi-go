import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='artifacts/browser-acceptance',base=process.argv[2]||'http://localhost:3000';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('textbox',{name:'Что хотите найти?'}).waitFor({timeout:60000});console.log((await page.locator('body').innerText()).slice(0,6000));await page.screenshot({path:dir+'/home-1440.png',fullPage:true});await writeFile(dir+'/smoke.json',JSON.stringify({errors},null,2));}finally{await browser.close();}
