import {db} from '@/db';
import {buyerCookie,buyerOrigin} from '@/lib/buyer-auth';
import {hash,token} from '@/lib/onboarding';
/** Isolated, unpublished demo conversation. Never available in a production build. */
export async function POST(req:Request){
 if(process.env.NODE_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname))return new Response('Not found',{status:404});
 try{
  buyerOrigin(req);const role=new URL(req.url).searchParams.get('as');if(role!=='buyer'&&role!=='seller')return Response.json({error:'Выберите тестового покупателя или продавца.'},{status:400});
  const seller='telegram:local-chat-seller',buyer='max:local-chat-buyer',storeId='c4af2710-1000-4000-8000-000000000001',productId='c4af2710-1000-4000-8000-000000000002',threadId='c4af2710-1000-4000-8000-000000000003',now=Date.now(),raw=token();
  const shop={id:storeId,name:'Локальный тест чата',sellerType:'private',city:'Казань',street:'Тестовая точка',lat:55.8,lng:49.1,phone:'',contact:'',email:'',category:'Личные вещи',description:'',hours:'',site:'',photos:[],status:'reference',demo:true,addressConfirmed:true,visibility:'draft'};
  const product={id:productId,storeId,name:'Тестовый велосипед · локальный чат',description:'Только для проверки переписки. Не продаётся.',category:'Личные вещи',condition:'used',price:5500,quantity:1,brand:'',model:'',features:'',sku:'',keywords:'',photos:[],demo:true,published:false};
  await db().batch([
   ...([{id:seller,provider:'telegram',subject:'local-chat-seller',name:'Тестовый продавец'},{id:buyer,provider:'max',subject:'local-chat-buyer',name:'Тестовый покупатель'}] as const).flatMap(a=>[
    db().prepare('INSERT INTO buyer_accounts(id,provider,subject,name,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(a.id,a.provider,a.subject,a.name,now),
    db().prepare('INSERT INTO buyer_identities(provider,subject,buyer_id,created_at) VALUES(?,?,?,?) ON CONFLICT(provider,subject) DO NOTHING').bind(a.provider,a.subject,a.id,now),
   ]),
   db().prepare("INSERT INTO shops(id,owner,data,visibility) VALUES(?,?,?,'draft') ON CONFLICT(id) DO NOTHING").bind(storeId,seller,JSON.stringify(shop)),
   db().prepare('INSERT INTO products(id,store_id,published,data) VALUES(?,?,0,?) ON CONFLICT(id) DO NOTHING').bind(productId,storeId,JSON.stringify(product)),
   db().prepare('INSERT INTO chat_threads(id,product_id,buyer_id,seller_id,product_name,photo_url,city,buyer_name,seller_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(threadId,productId,buyer,seller,product.name,'',shop.city,'Тестовый покупатель','Тестовый продавец',now,now),
   db().prepare('INSERT INTO buyer_sessions(hash,buyer_id,expires_at,login_provider) VALUES(?,?,?,?)').bind(await hash(raw),role==='buyer'?buyer:seller,now+7*86400000,role==='buyer'?'max':'telegram'),
  ]);
  return Response.json({threadId,role},{headers:{'Set-Cookie':buyerCookie('ng_buyer',raw,7*86400),'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Не удалось открыть локальный тест чата.'},{status:400});}
}
