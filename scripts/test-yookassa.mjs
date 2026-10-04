// Sandbox connectivity only: does not activate subscriptions or accept real money.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
const config=parseEnv(readFileSync('.env.yookassa.test','utf8'));
if(config.YOOKASSA_TEST_MODE!=='1'||!config.YOOKASSA_SECRET_KEY?.startsWith('test_'))throw Error('Only test credentials permitted');
const folder='artifacts/yookassa';mkdirSync(folder,{recursive:true});
const headers={Authorization:'Basic '+Buffer.from(config.YOOKASSA_SHOP_ID+':'+config.YOOKASSA_SECRET_KEY).toString('base64'),'Content-Type':'application/json'};
async function request(path,method='GET',body,key){
 const r=await fetch('https://api.yookassa.ru/v3/'+path,{method,headers:{...headers,...(key?{'Idempotence-Key':key}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const b=await r.json();if(!r.ok)throw Error(`YooKassa HTTP ${r.status}; code=${b.code||'unknown'}; parameter=${b.parameter||'none'}`);return b;
}
const shop=await request('me');
if(shop.test!==true)throw Error('Provider did not confirm test shop; refusing payment creation');
const key=randomUUID();
// Persist before sending: reuse key manually if network outcome is uncertain.
writeFileSync(folder+'/pending-operation.json',JSON.stringify({key,shopId:config.YOOKASSA_SHOP_ID,createdAt:new Date().toISOString()}));
const body={amount:{value:'1.00',currency:'RUB'},capture:false,confirmation:{type:'redirect',return_url:'https://naydigo.prepromo.ru/'},description:'НайдиGo: технический тест интеграции, не подписка',metadata:{purpose:'integration_test'}};
const payment=await request('payments','POST',body,key);
if(payment.test!==true)throw Error('Unexpected non-test response');
const duplicate=await request('payments','POST',body,key);
const checked=await request('payments/'+encodeURIComponent(payment.id));
const report={shopId:config.YOOKASSA_SHOP_ID,test:checked.test,paymentId:checked.id,status:checked.status,paid:checked.paid,amount:checked.amount,idempotencyPassed:duplicate.id===payment.id,checkedAt:new Date().toISOString(),confirmationUrl:payment.confirmation?.confirmation_url,subscriptionActivated:false};
writeFileSync(folder+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,confirmationUrl:report.confirmationUrl?'saved locally':null},null,2));
