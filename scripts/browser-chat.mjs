// Real local HTTP + PostgreSQL; two separate sessions. Only test accounts receive messages.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base='http://localhost:3001',out='artifacts/chat';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const report={database:'real local PostgreSQL',bots:'not contacted',publicListing:false};
try{
 const buyer=await browser.newContext({viewport:{width:390,height:900}}),seller=await browser.newContext({viewport:{width:1440,height:1000}});
 const b=await buyer.newPage(),s=await seller.newPage();
 await b.goto(base+'/messages?product=11111111-1111-4111-8111-111111111111');
 await expect(b.getByRole('heading',{name:'Войдите, чтобы написать продавцу'})).toBeVisible();await expect(b.getByRole('link',{name:'Войти через Telegram или MAX'})).toHaveAttribute('href',/return_to=/);
 const buyerLogin=await buyer.request.post(base+'/api/dev/chat-demo?as=buyer',{headers:{Origin:base}});expect(buyerLogin.status()).toBe(200);const fixture=await buyerLogin.json();await b.goto(base+'/messages?thread='+fixture.threadId);
 await expect(b.getByLabel('Сообщение',{exact:true})).toBeVisible();const threadId=new URL(b.url()).searchParams.get('thread');
 const beforeAssist=await b.getByRole('log').locator('.chat-bubble').count();
 await b.getByLabel('Что уточнить у продавца?').fill('Уточни, можно ли забрать товар сегодня вечером');
 await b.getByRole('button',{name:'Помочь написать'}).click();
 await expect(b.getByLabel('Сообщение',{exact:true})).toHaveValue(/.+/,{timeout:30000});
 expect(await b.getByRole('log').locator('.chat-bubble').count()).toBe(beforeAssist);
 await b.getByLabel('Сообщение',{exact:true}).fill('');
 const question='Можно забрать сегодня? Тест '+randomUUID(),reply='Да, после 18:00. Тест '+randomUUID();
 await b.getByLabel('Сообщение',{exact:true}).fill(question);await b.getByRole('button',{name:'Отправить',exact:true}).click();await expect(b.getByRole('log').getByText(question,{exact:true})).toBeVisible();
 await s.goto(base+'/messages');await expect(s.getByRole('heading',{name:'Войдите, чтобы написать продавцу'})).toBeVisible();const sellerLogin=await seller.request.post(base+'/api/dev/chat-demo?as=seller',{headers:{Origin:base}});expect(sellerLogin.status()).toBe(200);await s.goto(base+'/messages?thread='+fixture.threadId);await expect(s.getByRole('log').getByText(question,{exact:true})).toBeVisible({timeout:15000});
 await b.bringToFront();await expect(b.getByRole('log').locator('.chat-bubble').filter({hasText:question}).getByText('Прочитано',{exact:false})).toBeVisible({timeout:15000});
 let failNext=true;const attempts=[];
 await s.route('**/api/messages',route=>{if(route.request().method()!=='POST')return route.continue();const data=route.request().postDataJSON();if(data.action==='send'){attempts.push(data.id);if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Тест: сеть недоступна. Повторите отправку.'}});}}return route.continue();});
 await s.getByLabel('Сообщение',{exact:true}).fill(reply);await s.getByRole('button',{name:'Отправить',exact:true}).click();await expect(s.getByRole('alert')).toContainText('Повторите отправку');await expect(s.getByLabel('Сообщение',{exact:true})).toHaveValue(reply);
 await s.getByRole('button',{name:'Отправить',exact:true}).click();await expect(s.getByRole('log').getByText(reply,{exact:true})).toBeVisible();expect(attempts).toHaveLength(2);expect(attempts[0]).toBe(attempts[1]);
 await b.bringToFront();await expect(b.getByRole('log').getByText(reply,{exact:true})).toBeVisible({timeout:15000});await b.reload();await s.reload();
 for(const page of [b,s]){await expect(page.getByRole('log').getByText(question,{exact:true})).toHaveCount(1);await expect(page.getByRole('log').getByText(reply,{exact:true})).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await b.screenshot({path:out+'/buyer-390.png',fullPage:true});await s.screenshot({path:out+'/seller-1440.png',fullPage:true});
 const other=await browser.newContext();await other.request.post(base+'/api/dev/seller-session',{headers:{Origin:base}});const response=await other.request.get(base+'/api/messages?thread='+threadId);expect(response.status()).toBe(404);
 const strangerAssist=await other.request.post(base+'/api/messages/assist',{headers:{Origin:base},data:{threadId,goal:'Уточни цену'}});expect(strangerAssist.status()).toBe(404);await other.close();
 await b.getByRole('button',{name:'Все диалоги',exact:true}).click();await expect(b.getByRole('complementary',{name:'Диалоги'})).toBeVisible();await b.getByRole('complementary',{name:'Диалоги'}).getByRole('button',{name:/Тестовый велосипед/}).click();await expect(b.getByRole('log').getByText(reply,{exact:true})).toBeVisible();
 Object.assign(report,{guestLoginRequired:true,agentDraftPrepared:true,agentDraftNotAutoSent:true,buyerToSeller:true,sellerToBuyer:true,automaticUpdates:true,readReceipt:true,reloadPersists:true,failedSendKeepsText:true,retryReusesId:true,thirdAccountRejected:true,mobileDialogSwitch:true,widths:[390,1440]});console.log('PASS',JSON.stringify(report));await buyer.close();await seller.close();
}finally{await browser.close();await writeFile(out+'/browser-report.json',JSON.stringify(report,null,2));}
