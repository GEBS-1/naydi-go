import {env} from 'cloudflare:workers';
import {db} from '@/db';
import {hash,token} from './onboarding';
import {quota} from './discovery-server';
import {buyerConfig} from './buyer-config';
import {buyerOrigin,buyerCookie,cookieValue,issueBuyerSession} from './buyer-auth';
import {z} from 'zod';
export function yandexReady(){return buyerConfig().enabled&&env.YANDEX_AUTH_ENABLED==='1'&&!!env.YANDEX_CLIENT_ID&&!!env.YANDEX_CLIENT_SECRET;}
const redirectUri=()=>new URL('/api/buyer/yandex/callback',buyerConfig().base).href;
export async function startYandex(req:Request){
 buyerOrigin(req);if(!yandexReady())throw Error('Вход через Яндекс пока не настроен');
 await quota('global','buyer-login',100);
 const browser=token(),state=token(),browserHash=await hash(browser);
 await db().prepare('DELETE FROM buyer_logins WHERE expires_at<?').bind(Date.now()-86400000).run();
 await db().prepare('INSERT INTO buyer_logins(hash,browser_hash,provider,expires_at) VALUES(?,?,?,?)').bind(await hash(state),browserHash,'yandex',Date.now()+300000).run();
 const challenge=btoa(String.fromCharCode(...browserHash.match(/../g)!.map(x=>parseInt(x,16)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const url=new URL('https://oauth.yandex.ru/authorize');url.search=new URLSearchParams({response_type:'code',client_id:env.YANDEX_CLIENT_ID!,redirect_uri:redirectUri(),scope:'login:info',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
 return {url:url.href,cookie:buyerCookie('ng_yandex',browser,300)};
}
export async function finishYandex(req:Request){
 if(!yandexReady())throw Error('Unavailable');
 const url=new URL(req.url),state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'',browser=cookieValue(req,'ng_yandex');
 if(url.searchParams.has('error')||!browser||! /^[a-f0-9]{64}$/.test(state)||!code||code.length>2048)throw Error('Invalid callback');
 const key=await hash(state);
 const claimed=await db().prepare("UPDATE buyer_logins SET attempts=1 WHERE hash=? AND browser_hash=? AND provider='yandex' AND consumed=0 AND attempts=0 AND expires_at>? RETURNING hash").bind(key,await hash(browser),Date.now()).first();
 if(!claimed)throw Error('Expired or replayed callback');
 const r=await fetch('https://oauth.yandex.ru/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:env.YANDEX_CLIENT_ID!,client_secret:env.YANDEX_CLIENT_SECRET!,redirect_uri:redirectUri(),code_verifier:browser}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Token exchange failed');
 const access=z.object({access_token:z.string().min(1).max(8192)}).parse(await r.json());
 const info=await fetch('https://login.yandex.ru/info?format=json',{redirect:'error',headers:{Authorization:'OAuth '+access.access_token},signal:AbortSignal.timeout(12000)});
 if(!info.ok)throw Error('Identity verification failed');
 const user=z.object({id:z.string().regex(/^\d{1,30}$/),client_id:z.string(),display_name:z.string().max(200).optional(),real_name:z.string().max(200).optional()}).parse(await info.json());
 if(user.client_id!==env.YANDEX_CLIENT_ID)throw Error('Wrong application');
 // Never merge different providers by email/name. Access tokens are not persisted.
 return issueBuyerSession(req,{hash:key,provider:'yandex',subject:user.id,name:(user.display_name||user.real_name||'Пользователь Яндекса').slice(0,100)});
}
