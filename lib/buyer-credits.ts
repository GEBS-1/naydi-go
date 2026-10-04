import {db} from '@/db';
import {buyerIdentity} from './buyer-auth';
import {sameOrigin} from './onboarding';
import {buyerConfig} from './buyer-config';
export async function buyerBalance(id:string){const rows=await db().prepare('SELECT kind,SUM(remaining) AS remaining,MAX(expires_at) AS expiresAt FROM buyer_grants WHERE buyer_id=? AND (expires_at IS NULL OR expires_at>?) GROUP BY kind').bind(id,Date.now()).all<{kind:string;remaining:number;expiresAt:number|null}>();return rows.results;}
export async function reserveBuyerSearch(req:Request){
 sameOrigin(req);
 if(!buyerConfig().quota)return null;
 const buyer=await buyerIdentity(req);
 // During public search validation guests are not charged. Provider/global
 // anti-abuse limits remain active in the search APIs.
 if(!buyer)return null;
 const id=buyer.id;
 const operation=crypto.randomUUID();
 const r=await db().batch([
  db().prepare("INSERT INTO buyer_searches(id,buyer_id,grant_id,status,created_at) SELECT ?,?,id,'reserved',? FROM buyer_grants WHERE buyer_id=? AND remaining>0 AND (expires_at IS NULL OR expires_at>?) ORDER BY CASE WHEN kind='free' THEN 0 ELSE 1 END,expires_at LIMIT 1").bind(operation,id,Date.now(),id,Date.now()),
  db().prepare('UPDATE buyer_grants SET remaining=remaining-1 WHERE id=(SELECT grant_id FROM buyer_searches WHERE id=?) AND changes()=1').bind(operation)
 ]);
 if(!r[0].meta.changes)throw Error('Бесплатный лимит или пакет поисков исчерпан. Откройте «Моё» → тариф Pro.');
 return {id:operation,cookie:null};
}
export async function settleBuyerSearch(id:string,success:boolean){await db().batch([
 db().prepare("UPDATE buyer_grants SET remaining=remaining+1 WHERE id=(SELECT grant_id FROM buyer_searches WHERE id=? AND status='reserved') AND ?=0").bind(id,success?1:0),
 db().prepare("UPDATE buyer_searches SET status=? WHERE id=? AND status='reserved'").bind(success?'complete':'refunded',id)
]);}
export async function requireBuyerCredit(req:Request){if(!buyerConfig().quota)return;const buyer=await buyerIdentity(req);if(!buyer)return;const balance=await buyerBalance(buyer.id);if(balance.length&&!balance.some(b=>b.remaining>0))throw Error('Поиски закончились. Откройте «Моё» → тариф Pro.');}
// Count a submitted API operation once; return credit for errors, including streamed errors.
export async function buyerOperation(req:Request,work:()=>Promise<Response>){let reservation:Awaited<ReturnType<typeof reserveBuyerSearch>>=null;try{
 reservation=await reserveBuyerSearch(req);const response=await work();if(!reservation)return response;
 const headers=new Headers(response.headers);if(reservation.cookie)headers.set('Set-Cookie',reservation.cookie);
 if(!response.ok){await settleBuyerSearch(reservation.id,false);return new Response(response.body,{status:response.status,headers});}
 if(!response.body){await settleBuyerSearch(reservation.id,true);return new Response(null,{status:response.status,headers});}
 const reader=response.body.getReader(),decoder=new TextDecoder();let failed=false,tail='',finished=false;const id=reservation.id;
 const settle=async(ok:boolean)=>{if(!finished){finished=true;await settleBuyerSearch(id,ok);}};
 const body=new ReadableStream({async pull(controller){try{const {done,value}=await reader.read();if(done){await settle(!failed);controller.close();return;}tail+=decoder.decode(value,{stream:true});if(/"error"\s*:|"chargeable"\s*:\s*false/.test(tail))failed=true;tail=tail.slice(-150);controller.enqueue(value);}catch{await settle(false);controller.error(new Error('Поиск прерван'));}},async cancel(){await reader.cancel();await settle(false);}});
 return new Response(body,{status:response.status,headers});
 }catch(e){if(reservation)await settleBuyerSearch(reservation.id,false);return Response.json({error:(e as Error).message,accountUrl:'/account'},{status:402,headers:{'Cache-Control':'no-store'}});}}
