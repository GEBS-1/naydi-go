import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/browser-final',report=[];await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:950}}),tiles=[];
 page.on('response',r=>{if(r.url().includes('tile.openstreetmap.org'))tiles.push({url:r.url(),status:r.status()});});
 page.on('requestfailed',r=>{if(r.url().includes('tile.openstreetmap.org'))tiles.push({url:r.url(),failure:r.failure()});});
 page.on('console',m=>{if(m.type()==='error')tiles.push({console:m.text()});});
 const shot=name=>page.screenshot({path:`${out}/${name}-${width}.png`});
 try{
  await page.goto('http://localhost:3000/');
  await page.locator('.finder-photo input[type=file]').setInputFiles('artifacts/mvp-final/cc0-red-mug.jpg');
  await expect(page.getByAltText('Выбранный предмет')).toBeVisible();
  const received=page.waitForResponse(r=>r.url().endsWith('/api/search-image'),{timeout:90000});
  await page.getByRole('button',{name:'Распознать и найти похожее'}).click();
  const r=await received,b=await r.json();await shot('photo');report.push({scenario:'photo',width,status:r.status(),response:b,passed:r.ok()});
 }catch(e){report.push({scenario:'photo',width,error:e.message});await shot('photo-error');}
 try{
  await page.goto('http://localhost:3000/');
  await page.getByRole('textbox',{name:'Что хотите найти?'}).fill('цветы');
  await page.getByRole('button',{name:'По дороге',exact:true}).click();
  for(const [label,text] of [['Откуда вы едете?','Казань, Кремлёвская 1'],['Куда вы едете?','Казань, Дербышки']]){
   await page.getByLabel(label,{exact:true}).fill(text);
   const box=page.locator('.journey-address').filter({has:page.getByLabel(label,{exact:true})});
   await box.locator('li button').first().click({timeout:45000});
  }
  await expect(page.getByRole('textbox',{name:'Что хотите найти?'})).toHaveValue('цветы');
  const received=page.waitForResponse(r=>r.url().endsWith('/api/journey')&&r.request().method()==='POST',{timeout:60000}),start=Date.now();
  await page.getByRole('button',{name:'Найти товары по дороге',exact:true}).click();
  const r=await received,b=await r.json();
  if(r.ok()&&b.results?.length){
   await page.locator('.journey-results button').first().click();
   const link=await page.getByRole('link',{name:'Заехать',exact:true}).first().getAttribute('href');
   expect(new URL(link).searchParams.get('rtext').split('~')).toHaveLength(3);
   await page.locator('.journey-map').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.journey-tiles img')];return images.length>0&&images.every(n=>n.complete&&n.naturalWidth===256);},{},{timeout:20000});
   await page.waitForLoadState('networkidle',{timeout:25000}).catch(()=>{});
   await shot('route');
   report.push({scenario:'tiles',width,responses:tiles,loaded:await page.locator('.journey-tiles img[data-loaded=true]').count()});
   if(width===390){const layout=await page.evaluate(()=>{const nav=document.querySelector('.d-bottom').getBoundingClientRect(),scroller=document.querySelector('.ng-app>div:has(>.d-main)').getBoundingClientRect();return {navigationTop:nav.top,contentBottom:scroller.bottom};});expect(layout.contentBottom).toBeLessThanOrEqual(layout.navigationTop+1);report.push({scenario:'navigation-no-overlap',width,...layout});}
   report.push({scenario:'route',width,passed:true,ms:Date.now()-start,link,stores:b.results.map(x=>({name:x.shop.name,address:x.shop.street,extraSeconds:x.extraSeconds}))});
  }else{await shot('route-unavailable');report.push({scenario:'route',width,passed:false,status:r.status(),response:b});}
 }catch(e){report.push({scenario:'route',width,error:e.message});await shot('route-error');}
 await page.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));
}
await browser.close();console.log(JSON.stringify(report,null,2));
