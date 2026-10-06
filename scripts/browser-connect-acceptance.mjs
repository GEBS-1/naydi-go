import {chromium,expect} from '@playwright/test';
import {readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
const root='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const db=new DatabaseSync(path.join(root,readdirSync(root).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')));
db.exec('PRAGMA busy_timeout=5000');
const name='QA Connection '+Date.now(),out='artifacts/browser-acceptance',checks=[];
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const guest=await browser.newPage({viewport:{width:390,height:844}}),admin=await browser.newPage({viewport:{width:1440,height:1000}});
try {
 await guest.goto('http://localhost:3000/connect');
 await guest.waitForTimeout(1500); // let the client route hydrate before the first interaction
 await guest.getByRole('button',{name:'Оставить заявку',exact:true}).first().click();
 const application=guest.locator('dialog[open]');
 await application.getByLabel('Ваше имя').fill('QA Контакт');
 await application.getByLabel('Название магазина или компании').fill(name);
 await application.getByLabel('Телефон',{exact:true}).fill('+7 900 000-00-00');
 await application.getByLabel('Телефон, email или имя пользователя').fill('qa@example.invalid');
 await application.getByLabel('Что продаёте или какие услуги оказываете?').fill('Локальная проверка заявки, не реальный магазин');
 await application.getByLabel('Согласен на использование контактов для обработки этой заявки').check();
 await application.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(guest.getByRole('heading',{name:'Заявка получена'})).toBeVisible();
 await guest.screenshot({path:out+'/connection-390.png'});
 const row=db.prepare('SELECT id,status FROM connection_requests WHERE json_extract(data,\'$.name\')=?').get(name);
 expect(row.status).toBe('pending');
 expect(db.prepare('SELECT count(*) n FROM shops WHERE json_extract(data,\'$.name\')=?').get(name).n).toBe(0);
 checks.push('Public mobile form persists pending request without creating/publishing shop');
 await guest.goto('http://localhost:3000/connections');
 await expect(guest.getByRole('alert')).toContainText('Только для администратора');
 checks.push('Anonymous moderation access denied');
 await admin.goto('http://localhost:3000/signin-with-chatgpt?return_to=/connections');
 const select=admin.getByRole('combobox',{name:'Статус '+name,exact:true});
 await expect(select).toHaveValue('pending');
 const saved=admin.waitForResponse(r=>r.url().endsWith('/api/connect')&&r.request().method()==='PATCH');
 await select.selectOption('contacted');expect((await saved).status()).toBe(200);
 await admin.reload();await expect(select).toHaveValue('contacted');
 await admin.screenshot({path:out+'/connection-admin-1440.png'});
 checks.push('Local administrator moderates request; status survives reload');
} catch(e){checks.push('FAIL: '+e.message);process.exitCode=1;}
finally {
 db.prepare('DELETE FROM connection_requests WHERE json_extract(data,\'$.name\')=?').run(name);
 db.close();await browser.close();
 writeFileSync(out+'/connection-report.json',JSON.stringify({at:new Date().toISOString(),checks,scope:'Local browser acceptance; admin mock is not production authorization proof'},null,2));
 console.log(checks.join('\n'));
}
