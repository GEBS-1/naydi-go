// Isolated SQLite and provider fixtures. These are NOT real messenger/payment acceptance.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
mkdirSync('artifacts/buyer',{recursive:true});
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0006_buyer_access.sql','utf8'));sqlite.exec(readFileSync('drizzle/0007_bot_news.sql','utf8'));sqlite.exec(readFileSync('drizzle/0008_buyer_personal.sql','utf8'));
const wrap=(sql,args=[])=>({bind:(...a)=>wrap(sql,a),first:()=>sqlite.prepare(sql).get(...args)||null,all:()=>({results:sqlite.prepare(sql).all(...args)}),run:()=>({meta:{changes:sqlite.prepare(sql).run(...args).changes}})});
globalThis.testBuyerDB={prepare:wrap,batch:stmts=>{sqlite.exec('BEGIN IMMEDIATE');try{const r=stmts.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
globalThis.testBuyerEnv={BUYER_AUTH_ENABLED:'1',BUYER_QUOTA_ENABLED:'1',AUTH_BASE_URL:'https://naydigo.prepromo.ru',TELEGRAM_BOT_TOKEN:'fixture',TELEGRAM_BOT_USERNAME:'FixtureBot',TELEGRAM_WEBHOOK_SECRET:'fixture-secret',YOOKASSA_ENABLED:'1',YOOKASSA_TEST_MODE:'1',YOOKASSA_SECRET_KEY:'test_fixture',YOOKASSA_SHOP_ID:'fixture-shop'};
globalThis.testHash=async v=>createHash('sha256').update(v).digest('hex');globalThis.testToken=()=>randomBytes(32).toString('hex');
const stubs={
 'cloudflare:workers':'export const env=globalThis.testBuyerEnv;',
 '@/db':'export const db=()=>globalThis.testBuyerDB;',
 './onboarding':`export const hash=globalThis.testHash,token=globalThis.testToken;export const requestOrigin=req=>new URL(req.url).origin;export function sameOrigin(req){if(req.headers.get('origin')!==requestOrigin(req))throw Error('Origin');}`,
 './discovery-server':`export const quota=async()=>{};export const guest=async req=>({key:'guest-fixture',cookie:null});`
};
await build({stdin:{contents:"export * from './lib/buyer-yandex';export * from './lib/buyer-email';export * from './lib/buyer-auth';export * from './lib/buyer-bots';export * from './lib/buyer-credits';export * from './lib/buyer-payments';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'artifacts/buyer/test-bundle.mjs',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));}}]});
const api=await import(pathToFileURL(path.resolve('artifacts/buyer/test-bundle.mjs')));
const base='https://naydigo.prepromo.ru';const req=(cookie='',body={},headers={})=>new Request(base+'/api/buyer/auth',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const passed=[];const pass=name=>{passed.push(name);console.log('PASS',name);};
await assert.rejects(api.startBuyerLogin(req('',{}, {Origin:'https://evil.invalid'}),'telegram'));pass('Reject login CSRF');
const login=await api.startBuyerLogin(req(),'telegram'),challenge=new URL(login.url).searchParams.get('start'),browser=login.cookie.split(';')[0];let delivered='';
globalThis.fetch=async(_url,init)=>{delivered=JSON.parse(init.body).text;return Response.json({ok:true});};
const event={message:{chat:{type:'private',id:123},from:{id:123,first_name:'Fixture'},text:'/start '+challenge}};
assert.equal((await api.buyerBotWebhook(req('',event),'telegram')).status,403);pass('Reject forged webhook');
assert.equal((await api.buyerBotWebhook(req('',event,{'x-telegram-bot-api-secret-token':'fixture-secret'}),'telegram')).status,200);
assert.match(delivered,/Подтвердить/);
assert.equal((await api.pollBuyerLogin(req(browser))).authenticated,false);
const callback={callback_query:{id:'fixture-callback',from:{id:123,first_name:'Fixture'},message:{chat:{type:'private',id:123}},data:challenge}};
await api.buyerBotWebhook(req('',callback,{'x-telegram-bot-api-secret-token':'fixture-secret'}),'telegram');
assert.equal((await api.pollBuyerLogin(req('ng_login='+'a'.repeat(64)))).authenticated,false);
const cookie=(await api.pollBuyerLogin(req(browser))).cookie.split(';')[0];
assert.equal((await api.pollBuyerLogin(req(browser))).authenticated,false);
assert.equal((await api.buyerIdentity(req(cookie))).id,'telegram:123');pass('Explicit confirmation, browser binding, one-time login and server session');
await api.buyerBotWebhook(req('',{message:{...event.message,text:'/start'}},{'x-telegram-bot-api-secret-token':'fixture-secret'}),'telegram');assert.match(delivered,/Добро пожаловать/);pass('Plain Start responds with website link');
const reservations=await Promise.allSettled(Array.from({length:12},()=>api.reserveBuyerSearch(req(cookie))));assert.equal(reservations.filter(r=>r.status==='fulfilled').length,10);assert.equal((await api.buyerBalance('telegram:123'))[0].remaining,0);pass('Exactly ten reservations under concurrency');
const first=reservations[0].value;await api.settleBuyerSearch(first.id,false);await api.settleBuyerSearch(first.id,false);assert.equal((await api.buyerBalance('telegram:123'))[0].remaining,1);pass('Technical error refund is idempotent');
const failed=await api.buyerOperation(req(cookie),async()=>new Response('{"error":"fixture"}\n',{headers:{'Content-Type':'application/x-ndjson'}}));await failed.text();assert.equal((await api.buyerBalance('telegram:123'))[0].remaining,1);pass('Streamed error returns credit');
const unavailable=await api.buyerOperation(req(cookie),async()=>Response.json({hits:[],chargeable:false}));
await unavailable.text();assert.equal((await api.buyerBalance('telegram:123'))[0].remaining,1);pass('Empty result from failed sources refunds credit');
const good=await api.buyerOperation(req(cookie),async()=>Response.json({results:[]}));await good.text();assert.equal((await api.buyerBalance('telegram:123'))[0].remaining,0);assert.equal((await api.buyerOperation(req(cookie),async()=>Response.json({}))).status,402);pass('Search completes once and exhausted account is blocked');
let payment;
globalThis.fetch=async(_url,init)=>{if(init.method==='POST'){const body=JSON.parse(init.body);payment={id:'fixture-payment',test:true,status:'pending',paid:false,recipient:{account_id:'fixture-shop'},amount:body.amount,metadata:body.metadata,confirmation:{confirmation_url:'https://yoomoney.ru/fixture'}};}return Response.json(payment);};
const order=await api.createBuyerPayment('telegram:123');await api.reconcileBuyerPayment(order.id,'telegram:123');assert.equal((await api.buyerBalance('telegram:123'))[0].remaining,0);pass('Pending payment grants nothing');
await assert.rejects(api.reconcileBuyerPayment(order.id,'telegram:other'));payment.status='succeeded';payment.paid=true;payment.amount.value='0.01';await assert.rejects(api.reconcileBuyerPayment(order.id,'telegram:123'));payment.amount.value='149.00';payment.test=false;await assert.rejects(api.reconcileBuyerPayment(order.id,'telegram:123'));payment.test=true;pass('Reject foreign order, amount mismatch and live/test mismatch');
await Promise.all([api.reconcileBuyerPayment(order.id,'telegram:123'),api.reconcileBuyerPayment(order.id,'telegram:123')]);const grants=await api.buyerBalance('telegram:123');assert.equal(grants.find(g=>g.kind==='pro').remaining,100);pass('Verified payment credits exactly once');
sqlite.prepare("UPDATE buyer_grants SET expires_at=1 WHERE kind='pro'").run();await assert.rejects(api.reserveBuyerSearch(req(cookie)));pass('Expired Pro cannot be used');
await api.logoutBuyer(req(cookie));assert.equal(await api.buyerIdentity(req(cookie)),null);pass('Logout revokes session');
globalThis.testBuyerEnv.MAX_AUTH_ENABLED='1';globalThis.testBuyerEnv.MAX_BOT_TOKEN='fixture';globalThis.testBuyerEnv.MAX_BOT_URL='https://max.ru/fixture_bot';globalThis.testBuyerEnv.MAX_WEBHOOK_SECRET='max-secret';
globalThis.fetch=async()=>Response.json({success:true});
const maxLogin=await api.startBuyerLogin(req(),'max'),maxChallenge=new URL(maxLogin.url).searchParams.get('start'),maxBrowser=maxLogin.cookie.split(';')[0];
const maxEvent={update_type:'bot_started',user:{user_id:456,name:'MAX Fixture'},payload:maxChallenge};
assert.equal((await api.buyerBotWebhook(req('',maxEvent,{'x-max-bot-api-secret':'max-secret'}),'max')).status,200);
const maxCallback={update_type:'message_callback',callback:{callback_id:'fixture',user:{user_id:789},payload:maxChallenge}};
await api.buyerBotWebhook(req('',maxCallback,{'x-max-bot-api-secret':'max-secret'}),'max');assert.equal((await api.pollBuyerLogin(req(maxBrowser))).authenticated,false);
maxCallback.callback.user.user_id=456;await api.buyerBotWebhook(req('',maxCallback,{'x-max-bot-api-secret':'max-secret'}),'max');
const maxSession=(await api.pollBuyerLogin(req(maxBrowser))).cookie.split(';')[0];assert.equal((await api.buyerIdentity(req(maxSession))).id,'max:456');pass('MAX confirmation rejects another identity and establishes own session');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM bot_news_consent').get().n,0);
for(const command of ['/subscribe','/stop']){
 await api.buyerBotWebhook(req('',{message:{...event.message,text:command}},{'x-telegram-bot-api-secret-token':'fixture-secret'}),'telegram');
 assert.equal(sqlite.prepare('SELECT subscribed FROM bot_news_consent WHERE provider=? AND subject=?').get('telegram','123').subscribed,command==='/subscribe'?1:0);
 await api.buyerBotWebhook(req('',{update_type:'message_created',message:{sender:{user_id:456},recipient:{chat_type:'dialog'},body:{text:command}}},{'x-max-bot-api-secret':'max-secret'}),'max');
 assert.equal(sqlite.prepare('SELECT subscribed FROM bot_news_consent WHERE provider=? AND subject=?').get('max','456').subscribed,command==='/subscribe'?1:0);
}pass('Login never subscribes; explicit opt-in and unsubscribe work for both bots');
globalThis.testBuyerEnv.YANDEX_CLIENT_ID='fixture-yandex';globalThis.testBuyerEnv.YANDEX_CLIENT_SECRET='fixture-secret';globalThis.testBuyerEnv.YANDEX_AUTH_ENABLED='1';
const ya=await api.startYandex(req()),state=new URL(ya.url).searchParams.get('state'),yaCookie=ya.cookie.split(';')[0];
const callbackReq=cookie=>new Request(base+'/api/buyer/yandex/callback?state='+state+'&code=fixture',{headers:{Cookie:cookie}});
await assert.rejects(api.finishYandex(callbackReq('ng_yandex='+'a'.repeat(64))));
let yaCalls=0;globalThis.fetch=async(url,init)=>{yaCalls++;if(String(url).includes('/token')){assert.equal(new URLSearchParams(init.body).get('code_verifier'),yaCookie.split('=')[1]);return Response.json({access_token:'fixture-access'});}assert.equal(init.headers.Authorization,'OAuth fixture-access');return Response.json({id:'987',client_id:'fixture-yandex',display_name:'Яндекс'});};
const yaSession=(await api.finishYandex(callbackReq(yaCookie))).split(';')[0];assert.equal((await api.buyerIdentity(req(yaSession))).id,'yandex:987');await assert.rejects(api.finishYandex(callbackReq(yaCookie)));assert.equal(yaCalls,2);pass('Yandex PKCE, browser binding, verified identity, session and replay protection (fixtures)');
globalThis.testBuyerEnv.EMAIL_AUTH_ENABLED='1';globalThis.testBuyerEnv.EMAIL_FROM='НайдиGo <login@naydigo.prepromo.ru>';globalThis.testBuyerEnv.RESEND_API_KEY='fixture-resend';
let emailPayload;globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://api.resend.com/emails');assert.equal(init.headers.Authorization,'Bearer fixture-resend');emailPayload=JSON.parse(init.body);return Response.json({id:'fixture-email'});};
await api.startEmailLogin(req(),'User@Example.COM');assert.deepEqual(emailPayload.to,['user@example.com']);const emailLink=emailPayload.text.match(/https:\/\/[^\s]+/)[0],emailToken=new URL(emailLink).searchParams.get('token');assert.notEqual(sqlite.prepare("SELECT hash FROM buyer_logins WHERE provider='email' ORDER BY rowid DESC LIMIT 1").get().hash,emailToken);
const emailSession=(await api.finishEmailLogin(new Request(emailLink))).split(';')[0];assert.equal((await api.buyerIdentity(req(emailSession))).id,'email:user@example.com');await assert.rejects(api.finishEmailLogin(new Request(emailLink)));pass('Email magic link normalizes identity, stores only token hash, creates session and rejects replay (Resend fixture)');
writeFileSync('artifacts/buyer/unit-report.json',JSON.stringify({fixture:true,passed},null,2));sqlite.close();
