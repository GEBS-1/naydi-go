import {db} from '@/db';
import {hash,token,requestOrigin} from './onboarding';
import {buyerConfig,providerReady,type BuyerProvider} from './buyer-config';
import {env} from '@/lib/server-env';
import {quota,guest} from './discovery-server';
export function cookieValue(req:Request,name:string){return req.headers.get('cookie')?.match(new RegExp('(?:^|;\\s*)'+name+'=([a-f0-9]{64})'))?.[1]||'';}
export function buyerCookie(name:string,value:string,seconds:number){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${buyerConfig().base.startsWith('https:')?'; Secure':''}`;}
export function buyerOrigin(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==requestOrigin(req)||origin!==new URL(buyerConfig().base).origin)throw Error('Недопустимый источник запроса');}
export async function buyerIdentity(req:Request){if(!buyerConfig().enabled)return null;const value=cookieValue(req,'ng_buyer');if(!value)return null;return db().prepare('SELECT a.id,a.name,COALESCE(s.login_provider,a.provider) AS provider FROM buyer_accounts a JOIN buyer_sessions s ON s.buyer_id=a.id WHERE s.hash=? AND s.expires_at>?').bind(await hash(value),Date.now()).first<{id:string;name:string;provider:string}>();}
export async function linkBuyerAccount(req:Request,link:boolean){const account=link?await buyerIdentity(req):null;if(link&&(!account||!/^(telegram|max):[^:]+$/.test(account.id)))throw Error('Сначала войдите в аккаунт, к которому привязываете способ входа');return account;}
export async function startBuyerLogin(req:Request,provider:BuyerProvider,link=false){
 buyerOrigin(req);if(!providerReady(provider))throw Error('Этот способ входа пока недоступен');
 await quota('global','buyer-login',100);
 const account=await linkBuyerAccount(req,link);
 const browser=token(),challenge=token();await db().prepare('DELETE FROM buyer_logins WHERE expires_at<?').bind(Date.now()-86400000).run();
 await db().prepare('INSERT INTO buyer_logins(hash,browser_hash,provider,expires_at,link_buyer_id) VALUES(?,?,?,?,?)').bind(await hash(challenge),await hash(browser),provider,Date.now()+300000,account?.id||null).run();
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
 buyerOrigin(req);const current=await buyerIdentity(req);
 const browser=cookieValue(req,'ng_login');if(!browser)return {authenticated:!!current};
 const row=await db().prepare("SELECT * FROM buyer_logins WHERE browser_hash=? AND consumed=0 AND expires_at>? AND (code_hash='bot-confirmed-v1' OR code_hash LIKE 'bot-return-v1:%')").bind(await hash(browser),Date.now()).first<{hash:string;provider:string;subject:string;name:string}>();
 if(!row?.subject){const pending=await db().prepare('SELECT hash FROM buyer_logins WHERE browser_hash=? AND consumed=0 AND expires_at>?').bind(await hash(browser),Date.now()).first();return {authenticated:!pending&&!!current};}
 return {authenticated:true,cookie:await issueBuyerSession(req,row)};
}
export async function returnBuyerLogin(req:Request,challenge:string,secret:string){
 buyerOrigin(req);
 const row=await db().prepare('SELECT hash,provider,subject,name,link_buyer_id,consumed,browser_hash FROM buyer_logins WHERE hash=? AND code_hash=? AND expires_at>?')
  .bind(await hash(challenge),'bot-return-v1:'+await hash(secret),Date.now())
  .first<{hash:string;provider:string;subject:string;name:string;link_buyer_id:string|null;consumed:number;browser_hash:string}>();
 if(!row?.subject)throw Error('Ссылка устарела. Начните вход ещё раз.');
 const current=await buyerIdentity(req);
 if(row.link_buyer_id&&current?.id!==row.link_buyer_id)throw Error('Откройте исходную вкладку НайдиGO, чтобы завершить привязку.');
 if(row.consumed){
  const identity=await db().prepare('SELECT buyer_id FROM buyer_identities WHERE provider=? AND subject=?').bind(row.provider,row.subject).first<{buyer_id:string}>();
  if(current&&current.id===identity?.buyer_id)return {authenticated:true};
  throw Error('Вход уже завершён в исходной вкладке. Откройте её или начните вход здесь.');
 }
 const browser=cookieValue(req,'ng_login');
 if(!browser||await hash(browser)!==row.browser_hash)throw Error('Откройте НайдиGO в браузере, где вы начали вход. Исходная вкладка продолжит автоматически.');
 return {authenticated:true,cookie:await issueBuyerSession(req,row)};
}
export async function issueBuyerSession(req:Request,row:{hash:string;provider:string;subject:string;name:string}){
 const pending=await db().prepare('SELECT link_buyer_id FROM buyer_logins WHERE hash=?').bind(row.hash).first<{link_buyer_id:string|null}>();
 const identity=await db().prepare('SELECT buyer_id FROM buyer_identities WHERE provider=? AND subject=?').bind(row.provider,row.subject).first<{buyer_id:string}>();
 if(pending?.link_buyer_id){const current=await buyerIdentity(req);if(current?.id!==pending.link_buyer_id)throw Error('Для привязки вернитесь в исходный аккаунт');if(identity&&identity.buyer_id!==current.id)throw Error('Этот мессенджер уже привязан к другому аккаунту. Обратитесь в поддержку.');}
 const id=pending?.link_buyer_id||identity?.buyer_id||row.provider+':'+row.subject,session=token(),visitor=await guest(req);
 const result=await db().batch([
  db().prepare('UPDATE buyer_logins SET consumed=1 WHERE hash=? AND consumed=0 AND expires_at>? AND provider=? AND (subject IS NULL OR subject=?)').bind(row.hash,Date.now(),row.provider,row.subject),
  // Keep the saved name. The identity insert below still expects one affected row.
  db().prepare('INSERT INTO buyer_accounts(id,provider,subject,name,created_at) SELECT ?,?,?,?,? WHERE changes()=1 ON CONFLICT(id) DO UPDATE SET name=buyer_accounts.name').bind(id,row.provider,row.subject,row.name,Date.now()),
  db().prepare('INSERT INTO buyer_identities(provider,subject,buyer_id,created_at) SELECT ?,?,?,? WHERE changes()=1 ON CONFLICT(provider,subject) DO UPDATE SET buyer_id=buyer_id WHERE buyer_id=excluded.buyer_id').bind(row.provider,row.subject,id,Date.now()),
  db().prepare('INSERT INTO buyer_sessions(hash,buyer_id,expires_at,login_provider) SELECT ?,?,?,? WHERE changes()=1').bind(await hash(session),id,Date.now()+30*86400000,row.provider),
  db().prepare("INSERT OR IGNORE INTO buyer_grants(id,buyer_id,remaining,kind) SELECT ?,?,MIN(10,COALESCE((SELECT remaining FROM buyer_grants WHERE id=?),10)),'free' WHERE EXISTS(SELECT 1 FROM buyer_sessions WHERE hash=?)").bind('free:'+id,id,'free:guest:'+visitor.key,await hash(session)),
  db().prepare('UPDATE buyer_grants SET remaining=0 WHERE id=? AND EXISTS(SELECT 1 FROM buyer_sessions WHERE hash=?)').bind('free:guest:'+visitor.key,await hash(session))
 ]);
 if(!result[0].meta.changes||!result[2].meta.changes)throw Error('Код уже использован');
 return buyerCookie('ng_buyer',session,30*86400);
}
export async function logoutBuyer(req:Request){buyerOrigin(req);const value=cookieValue(req,'ng_buyer');if(value)await db().prepare('DELETE FROM buyer_sessions WHERE hash=?').bind(await hash(value)).run();return buyerCookie('ng_buyer','',0);}
