import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/launch-browser';await mkdir(out,{recursive:true});const report=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(15000);
 try{
  await page.goto('http://localhost:3000/');await page.getByRole('button',{name:'Изменить город'}).click();await page.getByLabel('Город',{exact:true}).fill('Самара');await page.getByRole('button',{name:'Выбрать',exact:true}).click();
  await page.screenshot({path:`${out}/home-${width}.png`});
  await page.goto('http://localhost:3000/#plan-new');await page.getByLabel('Ваша задача').fill('дрель, свёрла, дюбели, уровень до 10000');await page.getByRole('button',{name:'Создать подборку',exact:true}).click();
  await expect(page.getByLabel('Что найти',{exact:true})).toHaveCount(4);
  await page.getByPlaceholder('Убери уровень / дрель уже есть').fill('убери уровень');await page.getByRole('button',{name:'Применить уточнение'}).click();await expect(page.getByLabel('Что найти',{exact:true})).toHaveCount(3);
  await page.getByRole('button',{name:'Сохранить подборку',exact:true}).click();await expect(page.getByRole('status')).toContainText('сохранена');await page.reload();await expect(page.getByLabel('Что найти',{exact:true})).toHaveCount(3);
  await expect(page.getByText('Известная сумма: 0 ₽')).toBeVisible();await page.screenshot({path:`${out}/list-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.goto('http://localhost:3000/#home');await page.getByRole('textbox',{name:'Что хотите найти?'}).fill('несуществующий товар 938402');await page.getByRole('textbox',{name:'Что хотите найти?'}).press('Enter');
  await expect(page.locator('.finder-waiting')).toHaveCount(0,{timeout:90000});await page.screenshot({path:`${out}/search-${width}.png`});
  await page.goto('http://localhost:3000/#my');await page.screenshot({path:`${out}/my-${width}.png`});
  report.push({width,passed:true,scope:'Real browser, manual city, multi-item list, remove, save/reload, unknown prices, no horizontal overflow, real source failure/empty query. No responses mocked.'});
 }catch(e){report.push({width,error:e.message});process.exitCode=1;await page.screenshot({path:`${out}/failure-${width}.png`});}finally{await page.close();}
}
await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
