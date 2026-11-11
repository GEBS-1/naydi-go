import {db} from '@/db';
import {sellerIdentity,sellerFailure} from '@/lib/seller-access';
import {privateResponse} from '@/lib/discovery-server';

export async function GET(req:Request){try{
 const who=await sellerIdentity(req);
 const [products,threads,unread]=await Promise.all([
  db().prepare('SELECT p.id,p.published,p.data,s.visibility FROM products p JOIN shops s ON s.id=p.store_id WHERE s.owner=?').bind(who.key).all<{id:string;published:number;data:string;visibility:string}>(),
  db().prepare('SELECT product_id,COUNT(*) AS count FROM chat_threads WHERE seller_id=? GROUP BY product_id').bind(who.key).all<{product_id:string|null;count:number}>(),
  db().prepare('SELECT COUNT(*) AS count FROM chat_messages m JOIN chat_threads t ON t.id=m.thread_id WHERE t.seller_id=? AND m.sender_id<>? AND m.read_at IS NULL').bind(who.key,who.key).first<{count:number}>()
 ]);
 const items=products.results.map(row=>{const p=JSON.parse(row.data);return {id:row.id,status:p.quantity===0?'inactive':row.published&&row.visibility==='public'?'public':'pending',conversations:Number(threads.results.find(t=>t.product_id===row.id)?.count||0)};});
 return privateResponse({items,total:items.length,published:items.filter(p=>p.status==='public').length,pending:items.filter(p=>p.status==='pending').length,conversations:threads.results.reduce((n,t)=>n+Number(t.count),0),unread:Number(unread?.count||0)});
 }catch(e){const f=sellerFailure(e);return privateResponse({error:f?.error||'Не удалось загрузить статистику.'},f?.status||503);}}
