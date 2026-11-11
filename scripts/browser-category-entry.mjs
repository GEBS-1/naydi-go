import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const base=process.argv[2]||'http://127.0.0.1:5173',out='artifacts/category-entry';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const requests=[];
 await page.addInitScript(()=>localStorage.setItem('ng_city','Казань'));
 await page.route('**/api/search',async route=>{
  const body=route.request().postDataJSON();requests.push(body.query);
  const response={phase:'complete',hits:[],results:[],context:{query:body.query},intent:{kind:'product',journey:false,clarification:[]},sources:{osm:'mock',web:'mock',catalog:'mock'},timing:{parseMs:0,localMs:0,externalMs:0,totalMs:1},warnings:[]};
  await route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify(response)+'\n'});
 });
 await page.goto(base,{waitUntil:'networkidle'});
 const category=page.getByRole('link',{name:/Дом и ремонт/});
 await category.click();
 const locationPrompt=page.getByRole('region',{name:'Настройка местоположения для поиска'});
 await expect(locationPrompt).toBeVisible();
 await expect(locationPrompt).toContainText('Дом и ремонт');
 await page.screenshot({path:`${out}/01-location-choice.png`,fullPage:true});
 await locationPrompt.getByRole('button',{name:'Искать без геолокации'}).click();
 await expect(page).toHaveURL(/#search\//);
 await expect(page.getByText('Пока ничего не найдено')).toBeVisible();
 expect(requests).toEqual(['Дом и ремонт']);
 await page.screenshot({path:`${out}/02-category-results.png`,fullPage:true});
 console.log('PASS: category tap explains the location gate, proceeds to the selected search, and shows the honest empty state.');
}finally{await browser.close();}
