import {db} from '@/db';
import {buyerIdentity,buyerOrigin} from '@/lib/buyer-auth';
import {emptyPersonal,personalSchema,mergePersonal} from '@/lib/personal';
import {privateResponse,quota} from '@/lib/discovery-server';
export async function GET(req:Request){const user=await buyerIdentity(req);if(!user)return privateResponse({error:'Войдите в аккаунт'},401);const row=await db().prepare('SELECT data,version FROM buyer_personal WHERE buyer_id=?').bind(user.id).first<{data:string;version:number}>();return privateResponse({data:row?personalSchema.parse(JSON.parse(row.data)):emptyPersonal(),version:row?.version||0});}
export async function POST(req:Request){try{
 buyerOrigin(req);const user=await buyerIdentity(req);if(!user)return privateResponse({error:'Войдите в аккаунт'},401);await quota(user.id,'personal-sync',30);
 const reader=req.body?.getReader();if(!reader)return privateResponse({error:'Нет данных'},400);let size=0,raw='';const decoder=new TextDecoder();for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1000000){await reader.cancel();return privateResponse({error:'Слишком большой объём сохранений'},413);}raw+=decoder.decode(r.value,{stream:true});}raw+=decoder.decode();
 const local=personalSchema.parse(JSON.parse(raw));
 for(let attempt=0;attempt<3;attempt++){
  const row=await db().prepare('SELECT data,version FROM buyer_personal WHERE buyer_id=?').bind(user.id).first<{data:string;version:number}>();
  const data=mergePersonal(row?personalSchema.parse(JSON.parse(row.data)):emptyPersonal(),local);
  const result=row?await db().prepare('UPDATE buyer_personal SET data=?,version=version+1,updated_at=? WHERE buyer_id=? AND version=?').bind(JSON.stringify(data),Date.now(),user.id,row.version).run():await db().prepare('INSERT OR IGNORE INTO buyer_personal(buyer_id,data,version,updated_at) VALUES(?,?,1,?)').bind(user.id,JSON.stringify(data),Date.now()).run();
  if(result.meta.changes)return privateResponse({data,version:(row?.version||0)+1});
 }return privateResponse({error:'Сохранения изменились в другой вкладке. Повторите перенос.'},409);
 }catch{return privateResponse({error:'Не удалось перенести сохранения. Локальная копия не изменена; проверьте лимиты и повторите.'},400);}}
