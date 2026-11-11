import {isSellerProvider} from '@/lib/seller-providers';
import {z} from 'zod';
import {env} from '@/lib/server-env';
import {db} from '@/db';
import {buyerIdentity} from '@/lib/buyer-auth';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {productDraftProvider} from '@/lib/product-draft-provider';
import {requestOrigin} from '@/lib/onboarding';
import {quota} from '@/lib/discovery-server';

const short=z.string().trim().min(1).max(200);
function fail(error:string,status=400){return Response.json({error},{status});}

async function identity(req:Request){
  const existing=await getChatGPTUser(),buyer=await buyerIdentity(req);const user=buyer&&isSellerProvider(buyer.provider)?{userId:buyer.id,email:'',ownerSession:true}:existing;
  const old=req.headers.get('cookie')?.match(/(?:^|;\s*)ng_guest=([a-f0-9-]{36})/)?.[1];
  const guest=old||crypto.randomUUID();
  return {
    user,key:user?.userId||`guest:${guest}`,
    cookie:old?null:`ng_guest=${guest}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol==='https:'?'; Secure':''}`,
    admin:!!user&&!user.ownerSession&&!!env.ADMIN_EMAIL&&user.email.toLowerCase()===env.ADMIN_EMAIL.toLowerCase(),
  };
}

async function own(storeId:string,owner:string){
  const row=await db().prepare('SELECT id FROM shops WHERE id=? AND owner=?').bind(storeId,owner).first();
  if(!row)throw Error('Магазин не найден или недоступен');
}

/** Interactive AI card: photo/text → draft + clarifying questions → refine. */
export async function POST(req:Request){
  try{
    const origin=req.headers.get('origin');
    if(!origin||origin!==requestOrigin(req))return fail('Недопустимый источник запроса',403);
    if(Number(req.headers.get('content-length')||0)>6*1024*1024)return fail('Запрос слишком большой',413);
    const who=await identity(req);if(!who.user)return fail('Войдите через Telegram или MAX.',401);
    const body=z.object({
      storeId:short,
      description:z.string().trim().max(3000).optional(),
      image:z.string().max(1450000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
      shopCategory:z.string().trim().max(200).optional(),
      shopName:z.string().trim().max(200).optional(),
      previous:z.record(z.string(),z.unknown()).optional(),
      answers:z.record(z.string(),z.string().max(500)).optional(),
    }).parse(await req.json());
    if(!body.description&&!body.image&&!body.previous)return fail('Опишите товар, приложите фото или ответьте на уточнения');
    await own(body.storeId,who.key);
    await quota(who.key,'owner-product-draft',12);
    await quota('global','owner-product-draft',60);
    const session=await productDraftProvider().fromDescription({
      description:body.description,image:body.image,shopCategory:body.shopCategory,shopName:body.shopName,
      previous:body.previous as never,answers:body.answers,
    });
    return Response.json(session,{headers:who.cookie?{'Set-Cookie':who.cookie}:{}});
  }catch(e){
    return fail((e as Error).message||'Не удалось создать черновик',400);
  }
}
