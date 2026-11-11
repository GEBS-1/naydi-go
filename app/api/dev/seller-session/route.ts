import {db} from '@/db';
import {buyerCookie,buyerOrigin} from '@/lib/buyer-auth';
import {hash,token} from '@/lib/onboarding';
/** Explicit demo account for LOCAL development only; no bot or admin privileges. */
export async function POST(req:Request){
 if(process.env.NODE_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname))return new Response('Not found',{status:404});
 try{buyerOrigin(req);const raw=token(),id='telegram:local-demo',now=Date.now();await db().batch([
  db().prepare("INSERT INTO buyer_accounts(id,provider,subject,name,created_at) VALUES(?,'telegram','local-demo','Локальный тестовый продавец',?) ON CONFLICT(id) DO UPDATE SET name=excluded.name").bind(id,now),
  db().prepare("INSERT INTO buyer_identities(provider,subject,buyer_id,created_at) VALUES('telegram','local-demo',?,?) ON CONFLICT(provider,subject) DO NOTHING").bind(id,now),
  db().prepare("INSERT INTO buyer_sessions(hash,buyer_id,expires_at,login_provider) VALUES(?,?,?,'telegram')").bind(await hash(raw),id,now+7*86400000),
 ]);return Response.json({ok:true,demo:true},{headers:{'Set-Cookie':buyerCookie('ng_buyer',raw,7*86400),'Cache-Control':'no-store'}});}catch{return Response.json({error:'Не удалось открыть локальный тестовый аккаунт'},{status:400});}
}
