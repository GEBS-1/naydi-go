import {z} from 'zod';
import {db} from '@/db';
import {buyerIdentity} from '@/lib/buyer-auth';
import {socialSeller} from '@/lib/seller-access';
import {isSellerProvider} from '@/lib/seller-providers';
import {sameOrigin} from '@/lib/onboarding';
import {limitedBody} from '@/lib/request-body';
import {privateResponse,quota} from '@/lib/discovery-server';
import type {Product,Shop} from '@/lib/model';
import type {ChatThread,ChatMessage} from '@/lib/chat-model';
import {notifyAccount} from '@/lib/account-notify';

class ChatError extends Error{constructor(message:string,public status=400){super(message);}}
type ThreadRow={id:string;product_id:string|null;buyer_id:string;seller_id:string;product_name:string;photo_url:string;city:string;buyer_name:string;seller_name:string;updated_at:number;last_text?:string;unread?:number};
type MessageRow={id:string;seq:number;sender_id:string;body:string;sent_at:number;read_at:number|null};
async function actor(req:Request){const who=await buyerIdentity(req);if(!who||!isSellerProvider(who.provider)||!socialSeller(who.id))throw new ChatError('Войдите через Telegram или MAX, чтобы открыть сообщения.',401);return who;}
async function ownThread(id:string,actorId:string){const row=await db().prepare('SELECT * FROM chat_threads WHERE id=? AND (buyer_id=? OR seller_id=?)').bind(id,actorId,actorId).first<ThreadRow>();if(!row)throw new ChatError('Диалог не найден.',404);return row;}
const view=(r:ThreadRow,who:string):ChatThread=>({id:r.id,productId:r.product_id,productName:r.product_name,photoUrl:r.photo_url,city:r.city,role:r.buyer_id===who?'buyer':'seller',otherName:r.buyer_id===who?r.seller_name:r.buyer_name,updatedAt:Number(r.updated_at),lastText:r.last_text,unread:Number(r.unread||0)});
const messageView=(r:MessageRow,who:string):ChatMessage=>({id:r.id,seq:Number(r.seq),text:r.body,mine:r.sender_id===who,sentAt:Number(r.sent_at),readAt:r.read_at===null?null:Number(r.read_at)});
function failure(e:unknown){return privateResponse({error:e instanceof ChatError?e.message:e instanceof z.ZodError?'Проверьте сообщение. До 2000 символов.':(e as Error)?.message?.includes('Лимит')?'Слишком много сообщений. Попробуйте позже.':'Не удалось открыть или сохранить сообщения. Попробуйте ещё раз.'},e instanceof ChatError?e.status:e instanceof z.ZodError?400:(e as Error)?.message?.includes('Лимит')?429:503);}

export async function GET(req:Request){try{
 const who=await actor(req),params=new URL(req.url).searchParams,threadId=params.get('thread');
 if(threadId){
  const id=z.string().uuid().parse(threadId),thread=await ownThread(id,who.id),before=params.has('before')?z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(params.get('before')):null;
  const rows=await db().prepare('SELECT id,seq,sender_id,body,sent_at,read_at FROM chat_messages WHERE thread_id=?'+(before?' AND seq<?':'')+' ORDER BY seq DESC LIMIT 101').bind(id,...(before?[before]:[])).all<MessageRow>();
  const live=thread.product_id?await db().prepare('SELECT p.published,p.data,s.visibility,s.owner FROM products p JOIN shops s ON s.id=p.store_id WHERE p.id=?').bind(thread.product_id).first<{published:number;data:string;visibility:string;owner:string}>():null;
  const messages=rows.results.slice(0,100).reverse().map(r=>messageView(r,who.id));
  return privateResponse({thread:{...view(thread,who.id),available:!!live&&!!live.published&&live.visibility==='public'&&live.owner===thread.seller_id&&JSON.parse(live.data).quantity!==0},messages,hasMore:rows.results.length>100,before:messages[0]?.seq||null});
 }
 const cursorTime=params.has('beforeTime')?z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(params.get('beforeTime')):null,cursorId=cursorTime!==null?z.string().uuid().parse(params.get('beforeId')):null;
 const rows=await db().prepare('SELECT t.*, (SELECT body FROM chat_messages m WHERE m.thread_id=t.id ORDER BY seq DESC LIMIT 1) AS last_text, (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id=t.id AND m.sender_id<>? AND m.read_at IS NULL) AS unread FROM chat_threads t WHERE (t.buyer_id=? OR t.seller_id=?)'+(cursorTime!==null?' AND (t.updated_at<? OR (t.updated_at=? AND t.id<?))':'')+' ORDER BY t.updated_at DESC,t.id DESC LIMIT 41').bind(who.id,who.id,who.id,...(cursorTime!==null?[cursorTime,cursorTime,cursorId]:[])).all<ThreadRow>();
 return privateResponse({threads:rows.results.slice(0,40).map(r=>view(r,who.id)),hasMore:rows.results.length>40});
}catch(e){return failure(e);}}

const command=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),productId:z.string().uuid()}),
 z.object({action:z.literal('send'),threadId:z.string().uuid(),id:z.string().uuid(),text:z.string().trim().min(1).max(2000)}),
 z.object({action:z.literal('read'),threadId:z.string().uuid(),ids:z.array(z.string().uuid()).min(1).max(100)}),
]);
export async function POST(req:Request){try{
 try{sameOrigin(req);}catch{throw new ChatError('Недопустимый источник запроса.',403);}
 const who=await actor(req);let raw:Uint8Array;try{raw=await limitedBody(req,12000);}catch{throw new ChatError('Сообщение слишком большое.',413);}
 let value:unknown;try{value=JSON.parse(new TextDecoder().decode(raw));}catch{throw new ChatError('Проверьте данные сообщения.',400);}
 const body=command.parse(value),database=db(),now=Date.now();
 if(body.action==='start'){
  await quota(who.id,'chat-start',60);
  const row=await database.prepare("SELECT p.data,s.data AS shop_data,s.owner,a.name AS owner_name FROM products p JOIN shops s ON s.id=p.store_id JOIN buyer_accounts a ON a.id=s.owner WHERE p.id=? AND p.published=1 AND s.visibility='public'").bind(body.productId).first<{data:string;shop_data:string;owner:string;owner_name:string}>();
  if(!row||!socialSeller(row.owner))throw new ChatError('Продавец пока не подключён к чату или объявление недоступно.',404);
  const product=JSON.parse(row.data) as Product,shop=JSON.parse(row.shop_data) as Shop;
  if(product.demo||(product as Product&{testOnly?:boolean}).testOnly||shop.demo||product.quantity===0)throw new ChatError('Объявление недоступно.',404);
  if(row.owner===who.id)throw new ChatError('Это ваше объявление. Обращения покупателей появятся в разделе «Сообщения».');
  await database.prepare('INSERT INTO chat_threads(id,product_id,buyer_id,seller_id,product_name,photo_url,city,buyer_name,seller_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_id,buyer_id) DO NOTHING').bind(crypto.randomUUID(),body.productId,who.id,row.owner,product.name,product.photos[0]||'',shop.city,who.name,shop.sellerType==='private'?(shop.sellerName||row.owner_name):shop.name,now,now).run();
  const thread=await database.prepare('SELECT * FROM chat_threads WHERE product_id=? AND buyer_id=?').bind(body.productId,who.id).first<ThreadRow>();
  if(!thread||thread.seller_id!==row.owner)throw new ChatError('Владелец объявления изменился. Старый диалог сохранён в сообщениях.',409);
  return privateResponse({thread:view(thread,who.id)});
 }
 const thread=await ownThread(body.threadId,who.id);
 if(body.action==='read'){
  await quota(who.id,'chat-read',1200);await database.prepare('UPDATE chat_messages SET read_at=? WHERE thread_id=? AND sender_id<>? AND read_at IS NULL AND id IN ('+body.ids.map(()=>'?').join(',')+')').bind(now,thread.id,who.id,...body.ids).run();return privateResponse({ok:true});
 }
 await quota(who.id,'chat-send',300);
 const writes=await database.batch([
  database.prepare('INSERT INTO chat_messages(id,thread_id,sender_id,body,sent_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,thread.id,who.id,body.text,now),
  database.prepare('UPDATE chat_threads SET updated_at=CASE WHEN updated_at<? THEN ? ELSE updated_at END WHERE id=? AND changes()>0').bind(now,now,thread.id),
 ]);
 const saved=await database.prepare('SELECT id,seq,sender_id,body,sent_at,read_at FROM chat_messages WHERE id=? AND thread_id=? AND sender_id=?').bind(body.id,thread.id,who.id).first<MessageRow>();
 if(!saved||saved.body!==body.text)throw new ChatError('Этот запрос уже использован для другого сообщения. Обновите страницу и повторите.',409);
 if(writes[0]?.meta?.changes)await notifyAccount(thread.buyer_id===who.id?thread.seller_id:thread.buyer_id,'Новое сообщение в НайдиGO по объявлению «'+thread.product_name.slice(0,150)+'». Откройте переписку на сайте.','/messages');
 return privateResponse({message:messageView(saved,who.id)});
}catch(e){return failure(e);}}
