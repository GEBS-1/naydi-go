import {env} from '@/lib/server-env';
import {db} from '@/db';
export async function buyerAdmin(cookie:string|null){
 const id=env.ADMIN_BUYER_ID?.trim();
 const email=env.ADMIN_EMAIL?.trim().toLowerCase();
 if(!id)return null;
 const messengerAdmin=/^(telegram|max):[1-9]\d{0,29}$/.test(id);
 const legacyAdmin=!!email&&(/^yandex:\d{1,30}$/.test(id)||id==='email:'+email);
 if(!messengerAdmin&&!legacyAdmin)return null;
 const token=cookie?.match(/(?:^|;\s*)ng_buyer=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
 const user=await db().prepare('SELECT a.id,a.name FROM buyer_accounts a JOIN buyer_sessions s ON s.buyer_id=a.id WHERE s.hash=? AND s.expires_at>? AND a.id=?').bind(digest,Date.now(),id).first<{id:string;name:string}>();
 return user?{userId:user.id,displayName:user.name,email:messengerAdmin?'':email!,fullName:null,adminSession:messengerAdmin}:null;
}
