import {db} from '@/db';
import {actor,hash,privateHeaders} from '@/lib/onboarding';
import {ownerCookie,randomToken,digest,requireBrowserOrigin} from '@/lib/owner-auth';
import {quota} from '@/lib/discovery-server';
type Context={params:Promise<{token:string}>};
async function invitation(raw:string){if(!/^[a-f0-9]{64}$/.test(raw))return null;return db().prepare('SELECT i.*,s.data,s.owner,s.visibility FROM owner_invites i JOIN shops s ON i.store_id=s.id WHERE i.hash=? AND i.used_at IS NULL AND i.expires_at>?').bind(await hash(raw),new Date().toISOString()).first<{hash:string;store_id:string;email:string;data:string;owner:string|null;visibility:string}>();}
export async function GET(_req:Request,{params}:Context){const {token}=await params,i=await invitation(token);if(!i)return Response.json({error:'Приглашение недействительно'},{status:404,headers:privateHeaders});const a=await actor();return Response.json({name:JSON.parse(i.data).name,signedIn:!!a.user,emailMatches:a.user?.email.toLowerCase()===i.email,returning:!!i.owner},{headers:privateHeaders});}
export async function POST(req:Request,{params}:Context){try{
 requireBrowserOrigin(req);await quota('global','owner-invite',50);const {token}=await params,i=await invitation(token),a=await actor();
 if(!i||i.visibility!=='public'||!JSON.parse(i.data).ownerConfirmed)return Response.json({error:'Приглашение недействительно'},{status:403,headers:privateHeaders});
 if(a.user&&a.user.email.toLowerCase()!==i.email)return Response.json({error:'Выйдите из другого аккаунта перед принятием приглашения'},{status:403,headers:privateHeaders});
 const existing=await db().prepare('SELECT id FROM owner_accounts WHERE email=?').bind(i.email).first<{id:string}>();
 const userId=existing?.id||i.owner||a.user?.userId||crypto.randomUUID();if(i.owner&&i.owner!==userId)throw Error('Нужна ручная проверка учётной записи администратором');
 const now=new Date().toISOString(),raw=randomToken(),sessionHash=await digest(raw);
 // D1 batch is transactional. Consumption is the first conditional write; a replay cannot mint a session.
 const result=await db().batch([
  db().prepare('UPDATE owner_invites SET used_at=? WHERE hash=? AND used_at IS NULL AND expires_at>?').bind(now,i.hash,now),
  db().prepare('INSERT INTO owner_accounts(id,email,created_at) SELECT ?,?,? WHERE changes()=1 ON CONFLICT(email) DO UPDATE SET email=excluded.email').bind(userId,i.email,Date.now()),
  db().prepare("UPDATE shops SET owner=?,data=? WHERE changes()=1 AND id=? AND (owner IS NULL OR owner=?) AND visibility='public' AND EXISTS(SELECT 1 FROM owner_invites WHERE hash=? AND used_at=?)").bind(userId,JSON.stringify({...JSON.parse(i.data),status:'connected'}),i.store_id,userId,i.hash,now),
  db().prepare('INSERT INTO owner_sessions(hash,user_id,expires_at) SELECT ?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM owner_accounts WHERE id=?)').bind(sessionHash,userId,Date.now()+7*86400000,userId)
 ]);
 if(result[0].meta.changes!==1||result[3].meta.changes!==1)return Response.json({error:'Приглашение уже использовано'},{status:409,headers:privateHeaders});
 return Response.json({ok:true},{headers:{...privateHeaders,'Set-Cookie':ownerCookie(raw,req)}});
 }catch{return Response.json({error:'Не удалось принять приглашение. Проверьте ссылку или обратитесь к администратору.'},{status:400,headers:privateHeaders});}}
