import {buyerIdentity} from '@/lib/buyer-auth';
import {db} from '@/db';
import {env} from '@/lib/server-env';
import {privateResponse} from '@/lib/discovery-server';

export async function GET(req:Request){
 try{
  const user=await buyerIdentity(req);
  if(!user)return privateResponse({error:'Войдите в аккаунт.'},401);
  const contact=await db().prepare('SELECT phone FROM buyer_contact_phones WHERE buyer_id=?').bind(user.id).first<{phone:string}>();
  const base=user.provider==='telegram'?env.TELEGRAM_BOT_USERNAME&&'https://t.me/'+env.TELEGRAM_BOT_USERNAME.replace(/^@/,''):user.provider==='max'?env.MAX_BOT_URL:null;
  const url=base?new URL(base):null;
  url?.searchParams.set('start','phone');
  return privateResponse({phone:contact?.phone||'',url:url?.toString()||null,provider:user.provider});
 }catch{return privateResponse({error:'Не удалось получить телефон.'},503);}
}
