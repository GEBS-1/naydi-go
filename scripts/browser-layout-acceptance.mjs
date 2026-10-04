import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.argv[2]||'http://localhost:3000';
const out='artifacts/layout-acceptance';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={};

async function open(viewport,name){
  const page=await browser.newPage({viewport});
  page.setDefaultTimeout(120000);
  await page.addInitScript(()=>localStorage.setItem('ng_city','Казань'));
  await page.goto(base+'/#home',{waitUntil:'domcontentloaded'});
  await page.locator('html[data-naydi-hydrated="true"]').waitFor();
  await page.screenshot({path:`${out}/${name}-home.png`});
  await page.getByRole('link',{name:/Дом и ремонт/}).click();
  await page.locator('.search-hit').first().waitFor({state:'visible'});
  await page.screenshot({path:`${out}/${name}-results.png`});
  const cards=await page.locator('.search-hit').count();
  const image=await page.locator('.search-hit-image img').first().getAttribute('src');
  await page.getByRole('main').getByRole('link',{name:'Карта'}).click();
  await expect(page.locator('.finder-map-interactive')).toBeVisible();
  await page.screenshot({path:`${out}/${name}-map.png`});
  report[name]={cards,firstImage:image,mapVisible:await page.locator('.finder-map-interactive').isVisible()};
  await page.close();
}

try{
  await open({width:1440,height:1000},'desktop-1440');
  await open({width:390,height:844},'mobile-390');
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{await browser.close();}
