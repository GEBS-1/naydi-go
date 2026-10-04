import {db} from '@/db';
import {quota} from '@/lib/discovery-server';
import {reconcileBuyerPayment} from '@/lib/buyer-payments';
export async function POST(req:Request){try{await quota('global','payment-notify',300);const raw=await req.text();if(raw.length>16000)return new Response('Too large',{status:413});const b=JSON.parse(raw);if(b.type!=='notification'||b.event!=='payment.succeeded'||typeof b.object?.id!=='string')return Response.json({ok:true});const order=await db().prepare('SELECT id FROM buyer_payments WHERE provider_id=?').bind(b.object.id).first<{id:string}>();if(order)await reconcileBuyerPayment(order.id);return Response.json({ok:true});}catch{return new Response('Retry',{status:503});}}
