import {chromium,expect} from '@playwright/test';

const base=process.argv[2]||'http://localhost:3000';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto(base+'/connect',{waitUntil:'domcontentloaded'});
  const buyers=width<600?page.getByRole('link',{name:/НайдиGo/}).first():page.getByRole('link',{name:'Покупателям'});
  await expect(buyers).toHaveAttribute('href','/');
  await buyers.click();
  await expect(page).toHaveURL(new URL('/',base).href);
  await expect(page.getByRole('textbox',{name:'Что хотите найти?'})).toBeVisible();
  await page.close();
 }
 console.log('PASS: Покупателям returns from /connect to the buyer search on mobile and desktop.');
}finally{await browser.close();}
