import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {db} from '@/db';
import {hash,token} from './onboarding';
import {buyerConfig} from './buyer-config';
import {buyerOrigin,issueBuyerSession} from './buyer-auth';
import {guest,quota} from './discovery-server';

const emailSchema=z.string().trim().toLowerCase().email().max(254);
export function emailReady(){return buyerConfig().enabled&&env.EMAIL_AUTH_ENABLED==='1'&&!!env.RESEND_API_KEY&&!!env.EMAIL_FROM;}

export async function startEmailLogin(req:Request,value:unknown){
 buyerOrigin(req);if(!emailReady())throw Error('Вход по почте пока не настроен');
 const email=emailSchema.parse(value),visitor=await guest(req);
 await quota(visitor.key,'buyer-email-login',5);await quota('global','buyer-email-login',100);
 const challenge=token(),key=await hash(challenge),now=Date.now();
 await db().prepare('DELETE FROM buyer_logins WHERE expires_at<?').bind(now-86400000).run();
 await db().prepare('INSERT INTO buyer_logins(hash,browser_hash,provider,expires_at,subject,name) VALUES(?,?,?,?,?,?)').bind(key,await hash('email:'+challenge),'email',now+15*60000,email,email.slice(0,100)).run();
 const link=new URL('/api/buyer/email/callback',buyerConfig().base);link.searchParams.set('token',challenge);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:'Вход в НайдиGo',text:`Откройте ссылку, чтобы войти в НайдиGo. Ссылка действует 15 минут и используется один раз:\n\n${link.href}\n\nЕсли вы не запрашивали вход, просто проигнорируйте письмо.`,html:`<p>Откройте ссылку, чтобы войти в НайдиGo:</p><p><a href="${link.href}">Войти в НайдиGo</a></p><p>Ссылка действует 15 минут и используется один раз. Если вы не запрашивали вход, проигнорируйте письмо.</p>`,...(env.EMAIL_REPLY_TO?{reply_to:env.EMAIL_REPLY_TO}:{})}),signal:AbortSignal.timeout(12000)});
 if(!response.ok){await db().prepare('DELETE FROM buyer_logins WHERE hash=? AND consumed=0').bind(key).run();throw Error('Не удалось отправить письмо. Попробуйте позднее.');}
 return {cookie:visitor.cookie};
}

export async function finishEmailLogin(req:Request){
 if(!emailReady())throw Error('Unavailable');
 const challenge=new URL(req.url).searchParams.get('token')||'';if(!/^[a-f0-9]{64}$/.test(challenge))throw Error('Invalid link');
 const key=await hash(challenge),row=await db().prepare("SELECT hash,provider,subject,name FROM buyer_logins WHERE hash=? AND provider='email' AND consumed=0 AND attempts=0 AND expires_at>?").bind(key,Date.now()).first<{hash:string;provider:string;subject:string;name:string}>();
 if(!row?.subject)throw Error('Expired link');
 return issueBuyerSession(req,row);
}
