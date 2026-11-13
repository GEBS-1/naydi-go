import {chromium,expect} from '@playwright/test';

const base='http://127.0.0.1:3001';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.addInitScript(()=>localStorage.setItem('ng_analytics_consent_v1','no'));
  await page.route('**/api/buyer/me?summary=1',route=>route.fulfill({json:{user:{name:'Камиль J'}}}));
  await page.route('**/api/discovery',route=>route.fulfill({json:{city:'Казань'}}));
  await page.goto(base);
  const nav=width>690?page.locator('.v3-desktop-nav'):page.locator('.v3-mobile-nav');
  const profile=nav.locator('a[href="/#my"]');
  await expect(profile).toHaveCount(1);
  await expect(profile).toContainText(width>690?'Камиль J':'Профиль');
  await expect(page.locator('.reference-header .account-shortcut')).toHaveCount(0);
  await profile.click();
  await expect(page).toHaveURL(/#my$/);
  await expect(page.getByRole('heading',{name:'Камиль J'})).toBeVisible();
  await expect(page.getByLabel('Как вас называть?')).toBeVisible();
  await expect(page.getByRole('link',{name:'Способы входа',exact:true})).toBeVisible();
  await page.close();
 }
 console.log('PASS one profile entry, account name, profile edit and sign-in settings on desktop/mobile');
}finally{await browser.close();}
