import {env} from 'cloudflare:workers';
import {db} from '@/db';
import {buyerConfig} from './buyer-config';
type Payment={id:string;status:string;paid:boolean;test:boolean;amount:{value:string;currency:string};recipient:{account_id:string};metadata?:{order_id?:string};confirmation?:{confirmation_url?:string}};
type Order={id:string;buyer_id:string;provider_id:string|null;amount:number;searches:number;days:number;test:number;status:string;confirmation_url:string|null;created_at:number};
async function yookassa(path:string,method='GET',body?:unknown,key?:string){
 const config=buyerConfig();if(!config.payments||!env.YOOKASSA_SHOP_ID||!env.YOOKASSA_SECRET_KEY)throw Error('Оплата пока не подключена');
 // This release deliberately refuses live credentials until legal, receipts and live acceptance are complete.
 if(!config.test||!env.YOOKASSA_SECRET_KEY.startsWith('test_'))throw Error('Доступна только тестовая оплата');
 const r=await fetch('https://api.yookassa.ru/v3/'+path,{method,headers:{Authorization:'Basic '+btoa(env.YOOKASSA_SHOP_ID+':'+env.YOOKASSA_SECRET_KEY),'Content-Type':'application/json',...(key?{'Idempotence-Key':key}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const b=await r.json();if(!r.ok)throw Error('ЮKassa временно недоступна. Повторите проверку заказа, не создавайте новый.');return b as Payment;
}
function validatePayment(payment:Payment,order:Order){if(payment.test!==!!order.test||payment.recipient?.account_id!==env.YOOKASSA_SHOP_ID||payment.amount.currency!=='RUB'||payment.amount.value!==(order.amount/100).toFixed(2)||payment.metadata?.order_id!==order.id)throw Error('Параметры платежа не совпадают с заказом');}
export async function createBuyerPayment(buyerId:string){
 const {pro}=buyerConfig();let order=await db().prepare("SELECT * FROM buyer_payments WHERE buyer_id=? AND status IN ('creating','pending','waiting_for_capture') ORDER BY created_at DESC LIMIT 1").bind(buyerId).first<Order>();
 if(order?.status==='creating'&&order.created_at<Date.now()-23*3600000)throw Error('Нужно сверить предыдущую попытку платежа. Новый платёж не создаётся, обратитесь в поддержку.');
 if(!order){order={id:crypto.randomUUID(),buyer_id:buyerId,provider_id:null,amount:pro.price,searches:pro.searches,days:pro.days,test:1,status:'creating',confirmation_url:null,created_at:Date.now()};await db().prepare('INSERT INTO buyer_payments(id,buyer_id,amount,searches,days,test,status,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(order.id,buyerId,order.amount,order.searches,order.days,order.test,order.status,order.created_at).run();}
 if(order.confirmation_url)return {id:order.id,url:order.confirmation_url,test:true};
 const payment=await yookassa('payments','POST',{amount:{value:(order.amount/100).toFixed(2),currency:'RUB'},capture:true,confirmation:{type:'redirect',return_url:buyerConfig().base+'/account?payment='+order.id},description:'НайдиGo Pro: 100 поисков на 30 дней (тест)',metadata:{order_id:order.id}},order.id);
 validatePayment(payment,order);const url=payment.confirmation?.confirmation_url;if(!url||new URL(url).protocol!=='https:'||!['yoomoney.ru','yookassa.ru'].includes(new URL(url).hostname))throw Error('Не удалось получить безопасную ссылку оплаты');
 await db().prepare('UPDATE buyer_payments SET provider_id=?,status=?,confirmation_url=? WHERE id=?').bind(payment.id,payment.status,url,order.id).run();return {id:order.id,url,test:true};
}
export async function reconcileBuyerPayment(id:string,buyerId?:string){
 const order=await db().prepare('SELECT * FROM buyer_payments WHERE id=?').bind(id).first<Order>();if(!order||buyerId&&order.buyer_id!==buyerId)throw Error('Заказ не найден');if(!order.provider_id)return {status:'creating'};
 const payment=await yookassa('payments/'+encodeURIComponent(order.provider_id));validatePayment(payment,order);
 if(payment.status==='succeeded'&&payment.paid){await db().batch([
  db().prepare("INSERT OR IGNORE INTO buyer_grants(id,buyer_id,remaining,expires_at,kind,test) VALUES(?,?,?,?,'pro',?)").bind('payment:'+order.id,order.buyer_id,order.searches,Date.now()+order.days*86400000,order.test),
  db().prepare("UPDATE buyer_payments SET status='succeeded' WHERE id=?").bind(order.id)
 ]);}else await db().prepare('UPDATE buyer_payments SET status=? WHERE id=? AND status!=?').bind(payment.status,order.id,'succeeded').run();
 await db().prepare('INSERT INTO payment_audit(id,order_id,status,test,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),order.id,payment.status,+payment.test,Date.now()).run();
 return {status:payment.status,test:payment.test};
}
