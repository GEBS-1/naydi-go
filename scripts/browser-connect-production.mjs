import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const origin='https://naydigo.prepromo.ru';
const out='artifacts/connect-production';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
page.setDefaultTimeout(30000);
const report={origin,checks:[],console:[],assets:[]};
page.on('console',message=>report.console.push({type:message.type(),text:message.text()}));
page.on('requestfailed',request=>{if(request.url().includes('/_next/'))report.assets.push({url:request.url(),failure:request.failure()?.errorText});});
page.on('response',response=>{if(response.url().includes('/_next/'))report.assets.push({url:response.url(),status:response.status(),type:response.headers()['content-type']});});
try{
  await page.goto(origin+'/connect',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await writeFile(out+'/diagnostics.json',JSON.stringify(report,null,2));
  await expect(page.getByRole('link',{name:'Создать магазин бесплатно'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Посмотреть демо-магазин'})).toBeVisible();
  await page.getByRole('button',{name:'Оставить заявку'}).first().click();
  const select=page.getByLabel('Где вам ответить?');
  await expect(select).toBeVisible();
  const options=await select.locator('option').allTextContents();
  expect(options).toEqual(['Telegram','MAX','Телефон','Email']);
  report.checks.push('Public application offers Telegram, MAX, phone and email');
  await page.screenshot({path:out+'/application-channels-390.png'});
  await page.goto(origin+'/connections',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('alert')).toContainText('Только для администратора');
  report.checks.push('Anonymous moderation access denied');
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{await browser.close();}
