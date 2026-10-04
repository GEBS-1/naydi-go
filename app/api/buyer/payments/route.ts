import {z} from 'zod';
import {buyerIdentity,buyerOrigin} from '@/lib/buyer-auth';
import {createBuyerPayment,reconcileBuyerPayment} from '@/lib/buyer-payments';
import {quota} from '@/lib/discovery-server';
export async function POST(req:Request){try{buyerOrigin(req);const user=await buyerIdentity(req);if(!user)return Response.json({error:'Сначала войдите'},{status:401});await quota(user.id,'payment',20);const body=z.object({id:z.string().uuid().optional()}).parse(await req.json());return Response.json(body.id?await reconcileBuyerPayment(body.id,user.id):await createBuyerPayment(user.id),{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof z.ZodError?'Проверьте заказ':(e as Error).message},{status:400});}}
