import {db} from '@/db';
import {hash,token,requestOrigin} from './onboarding';
import {buyerConfig,providerReady,type BuyerProvider} from './buyer-config';
import {env} from 'cloudflare:workers';
import {quota,guest} from './discovery-server';
export function cookieValue(req:Request,name:string){return req.headers.get('cookie')?.match(new RegExp('(?:^|;\\s*)'+name+'=([a-f0-9]{64})'))?.[1]||'';}
export function buyerCookie(name:string,value:string,seconds:number){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${buyerConfig().base.startsWith('https:')?'; Secure':''}`;}
export function buyerOrigin(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==requestOrigin(req)||origin!==new URL(buyerConfig().base).origin)throw Error('Недопустимый источник запроса');}
export async function buyerIdentity(req:Request){if(!buyerConfig().enabled)return null;const value=cookieValue(req,'ng_buyer');if(!value)return null;return db().prepare('SELECT a.id,a.name,a.provider FROM buyer_accounts a JOIN buyer_sessions s ON s.buyer_id=a.id WHERE s.hash=? AND s.expires_at>?').bind(await hash(value),Date.now()).first<{id:string;name:string;provider:string}>();}
export async function startBuyerLogin(req:Request,provider:BuyerProvider){
 buyerOrigin(req);if(!providerReady(provider))throw Error('Этот способ входа пока недоступен');
 await quota('global','buyer-login',100);
 const browser=token(),challenge=token();await db().prepare('DELETE FROM buyer_logins WHERE expires_at<?').bind(Date.now()-86400000).run();
 await db().prepare('INSERT INTO buyer_logins(hash,browser_hash,provider,expires_at) VALUES(?,?,?,?)').bind(await hash(challenge),await hash(browser),provider,Date.now()+300000).run();
 const url=new URL(provider==='telegram'?`https://t.me/${env.TELEGRAM_BOT_USERNAME?.replace(/^@/,'')}`:env.MAX_BOT_URL!);
 if(url.protocol!=='https:'||url.hostname!==(provider==='telegram'?'t.me':'max.ru'))throw Error('Проверьте адрес бота');url.searchParams.set('start',challenge);
 return {url:url.toString(),cookie:buyerCookie('ng_login',browser,300)};
}
export async function finishBuyerLogin(req:Request,code:string){
 buyerOrigin(req);const browser=cookieValue(req,'ng_login');if(!browser||!/^\d{8}$/.test(code))throw Error('Проверьте код входа');
 const row=await db().prepare('UPDATE buyer_logins SET attempts=attempts+1 WHERE browser_hash=? AND consumed=0 AND attempts<5 AND expires_at>? RETURNING *').bind(await hash(browser),Date.now()).first<{hash:string;code_hash:string;provider:string;subject:string;name:string}>();
 if(!row||!row.subject||row.code_hash!==await hash(row.hash+':'+code))throw Error('Код неверен или устарел. Запросите новый вход.');
 return issueBuyerSession(req,row);
}
// Non-hash sentinel distinguishes an explicit bot confirmation from legacy numeric codes.
export async function pollBuyerLogin(req:Request){
 buyerOrigin(req);if(await buyerIdentity(req))return {authenticated:true};
 const browser=cookieValue(req,'ng_login');if(!browser)return {authenticated:false};
 const row=await db().prepare("SELECT * FROM buyer_logins WHERE browser_hash=? AND consumed=0 AND expires_at>? AND code_hash='bot-confirmed-v1'").bind(await hash(browser),Date.now()).first<{hash:string;provider:string;subject:string;name:string}>();
 if(!row?.subject)return {authenticated:false};
 return {authenticated:true,cookie:await issueBuyerSession(req,row)};
}
export async function issueBuyerSession(req:Request,row:{hash:string;provider:string;subject:string;name:string}){
 const id=row.provider+':'+row.subject,session=token(),visitor=await guest(req);
 const result=await db().batch([
  db().prepare('UPDATE buyer_logins SET consumed=1 WHERE hash=? AND consumed=0').bind(row.hash),
  db().prepare('INSERT INTO buyer_accounts(id,provider,subject,name,created_at) SELECT ?,?,?,?,? WHERE changes()=1 ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(id,row.provider,row.subject,row.name,Date.now()),
  db().prepare('INSERT INTO buyer_sessions(hash,buyer_id,expires_at) SELECT ?,?,? WHERE changes()=1').bind(await hash(session),id,Date.now()+30*86400000),
  db().prepare("INSERT OR IGNORE INTO buyer_grants(id,buyer_id,remaining,kind) SELECT ?,?,MIN(10,COALESCE((SELECT remaining FROM buyer_grants WHERE id=?),10)),'free' WHERE EXISTS(SELECT 1 FROM buyer_sessions WHERE hash=?)").bind('free:'+id,id,'free:guest:'+visitor.key,await hash(session)),
  db().prepare('UPDATE buyer_grants SET remaining=0 WHERE id=? AND EXISTS(SELECT 1 FROM buyer_sessions WHERE hash=?)').bind('free:guest:'+visitor.key,await hash(session))
 ]);
 if(!result[0].meta.changes)throw Error('Код уже использован');
 return buyerCookie('ng_buyer',session,30*86400);
}
export async function logoutBuyer(req:Request){buyerOrigin(req);const value=cookieValue(req,'ng_buyer');if(value)await db().prepare('DELETE FROM buyer_sessions WHERE hash=?').bind(await hash(value)).run();return buyerCookie('ng_buyer','',0);}
