import {guest} from '@/lib/discovery-server';
import {buyerEntitlements} from '@/lib/buyer-entitlements';
import {yandexReady} from '@/lib/buyer-yandex';
import {buyerIdentity,buyerOrigin} from '@/lib/buyer-auth';
import {buyerConfig,providerReady} from '@/lib/buyer-config';
import {buyerBalance} from '@/lib/buyer-credits';
import {db} from '@/db';
import {emailReady} from '@/lib/buyer-email';
import {limitedBody} from '@/lib/request-body';
import {privateResponse,quota} from '@/lib/discovery-server';
import {z} from 'zod';

const profileSchema=z.object({
 name:z.string().trim().min(2).max(100).refine(name=>!/[\p{Cc}\u202A-\u202E\u2066-\u2069]/u.test(name)),
});

export async function PATCH(req:Request){
 try{buyerOrigin(req);}catch{return privateResponse({error:'Недопустимый источник запроса.'},403);}
 try{
  const user=await buyerIdentity(req);
  if(!user)return privateResponse({error:'Войдите в аккаунт.'},401);
  let body:Uint8Array;
  try{body=await limitedBody(req,2048);}catch{return privateResponse({error:'Слишком большой запрос.'},413);}
  let input:unknown;
  try{input=JSON.parse(new TextDecoder().decode(body));}catch{return privateResponse({error:'Проверьте имя.'},400);}
  const profile=profileSchema.safeParse(input);
  if(!profile.success)return privateResponse({error:'Введите имя от 2 до 100 символов без переносов строки.'},400);
  const {name}=profile.data;
  await quota(user.id,'profile-name',30);
  if(name!==user.name){
   await db().batch([
    db().prepare('UPDATE buyer_accounts SET name=? WHERE id=?').bind(name,user.id),
    db().prepare('UPDATE chat_threads SET buyer_name=? WHERE buyer_id=?').bind(name,user.id),
   ]);
  }
  return privateResponse({user:{...user,name}});
 }catch(e){
  if(e instanceof Error&&e.message.includes('Лимит'))return privateResponse({error:'Слишком много изменений. Попробуйте позже.'},429);
  return privateResponse({error:'Не удалось сохранить имя.'},503);
 }
}
export async function GET(req:Request){try{const config=buyerConfig(),user=await buyerIdentity(req);if(new URL(req.url).searchParams.get('summary')==='1')return privateResponse({user:user?{id:user.id,name:user.name}:null});const visitor=await guest(req);const balance=await buyerBalance(user?.id||'guest:'+visitor.key);const orders=user?(await db().prepare('SELECT id,amount,status,test,created_at FROM buyer_payments WHERE buyer_id=? ORDER BY created_at DESC LIMIT 10').bind(user.id).all()).results:[];return Response.json({user,entitlements:await buyerEntitlements(req),providers:{email:emailReady(),yandex:yandexReady(),telegram:providerReady('telegram'),max:providerReady('max')},balance:balance.length?balance:!user?[{kind:'free',remaining:10,expiresAt:null}]:[],orders,free:config.free,pro:config.pro,payments:config.payments,test:config.test,quota:config.quota},{headers:{'Cache-Control':'no-store',...(!user&&visitor.cookie?{'Set-Cookie':visitor.cookie}:{})}});}catch{return Response.json({error:'Аккаунт временно недоступен'},{status:503});}}
