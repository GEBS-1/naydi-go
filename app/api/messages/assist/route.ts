import {z} from 'zod';
import {db} from '@/db';
import {buyerIdentity} from '@/lib/buyer-auth';
import {sameOrigin} from '@/lib/onboarding';
import {privateResponse,quota} from '@/lib/discovery-server';
import {routerCall} from '@/lib/router-gateway';

const request=z.object({threadId:z.string().uuid(),goal:z.string().trim().min(3).max(500)});

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const who=await buyerIdentity(req);
  if(!who)return privateResponse({error:'Войдите, чтобы поручить вопрос помощнику.'},401);
  const raw=await req.text();
  if(raw.length>2000)return privateResponse({error:'Слишком длинный запрос.'},413);
  const body=request.parse(JSON.parse(raw));
  const thread=await db().prepare('SELECT product_name,city FROM chat_threads WHERE id=? AND buyer_id=?').bind(body.threadId,who.id).first<{product_name:string;city:string}>();
  if(!thread)return privateResponse({error:'Диалог покупателя не найден.'},404);
  await quota(who.id,'buyer-message-assist',20);
  const answer=await routerCall({model:'qwen/qwen3-30b-a3b-instruct-2507',max_tokens:250,temperature:0,
   messages:[{role:'system',content:'Составь одно короткое вежливое сообщение продавцу на русском от имени покупателя. Используй только товар, город и цель из данных. Спроси о цене, наличии, времени получения или других условиях только если этого просит покупатель. Не утверждай, что товар есть в точке, не обещай покупку, бронь или оплату. Не вставляй телефон и личные данные. Верни только текст сообщения без кавычек и комментариев.'},{role:'user',content:JSON.stringify({product:thread.product_name,city:thread.city,goal:body.goal})}]});
  const draft=answer.choices?.[0]?.message.content?.trim().replace(/^['«"]|[’»"]$/g,'');
  if(!draft||draft.length>1000)return privateResponse({error:'Помощник не подготовил сообщение. Напишите продавцу своими словами.'},503);
  return privateResponse({draft});
 }catch{return privateResponse({error:'Помощник временно недоступен. Сообщение можно написать вручную.'},503);}
}
