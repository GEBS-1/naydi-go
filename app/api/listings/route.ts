import {z} from 'zod';
import {db} from '@/db';
import {sameOrigin,checkUploadOwnership} from '@/lib/onboarding';
import {sellerIdentity,sellerShop,sellerFailure} from '@/lib/seller-access';
import {privateResponse,quota} from '@/lib/discovery-server';
import {prepareProduct,productWrite} from '@/lib/product-command';
import type {Shop,Product} from '@/lib/model';
import {parseIntent} from '@/lib/city-search';
import {notifyConnectionRequest} from '@/lib/connection-notify';
import {moderationError,publishedSeller,reviewListing} from '@/lib/listing-moderation';

const inputSchema=z.object({id:z.string().uuid(),sellerName:z.string().trim().min(2).max(100).optional(),sellerType:z.enum(['private','business']).optional(),companyName:z.string().trim().max(200).optional(),name:z.string().trim().min(3).max(200),description:z.string().trim().min(10).max(4000),category:z.string().trim().min(1).max(200),condition:z.enum(['new','used']),price:z.number().min(0).max(1e9).nullable(),priceMode:z.enum(['fixed','negotiable','free']).optional(),photos:z.array(z.string().max(1000).regex(/^(?:\/api\/photos\/[a-f0-9-]{36}|https:\/\/[^\s]+)$/)).min(1).max(5),city:z.string().trim().min(1).max(100),street:z.string().trim().min(1).max(300),lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180),phone:z.string().trim().min(5).max(100).refine(value=>{const n=value.replace(/\D/g,'').length;return n>=10&&n<=15;}),consent:z.literal(true)});
export async function POST(req:Request){return saveListing(req,false);}
export async function PUT(req:Request){return saveListing(req,true);}
async function saveListing(req:Request,editing:boolean){try{
 sameOrigin(req);const who=await sellerIdentity(req);await quota(who.key,'listing-save',30);
 const input=inputSchema.parse(await req.json());if(input.price===null&&input.priceMode!=='negotiable')return privateResponse({error:'Укажите цену или выберите «Договорная».'},400);if(input.priceMode==='negotiable'&&input.price!==null)return privateResponse({error:'Для договорной цены оставьте сумму пустой.'},400);if(input.priceMode==='free'&&input.price!==0)return privateResponse({error:'Для бесплатного товара укажите цену 0.'},400);
 const previous=await db().prepare('SELECT p.id,p.store_id,s.owner,p.data FROM products p JOIN shops s ON s.id=p.store_id WHERE p.id=?').bind(input.id).first<{id:string;store_id:string;owner:string;data:string}>();
 if(previous&&previous.owner!==who.key)return privateResponse({error:'Нет доступа к объявлению'},403);
 if(editing&&!previous)return privateResponse({error:'Объявление не найдено'},404);
 if(previous&&!editing){await db().prepare("DELETE FROM listing_drafts WHERE owner=? AND json_extract(data,'$.id')=?").bind(who.key,input.id).run();return privateResponse({ok:true,id:previous.id,storeId:previous.store_id,alreadySaved:true,status:(JSON.parse(previous.data) as Product).published?'published':'pending'});}
 const prior:Product|undefined=previous?JSON.parse(previous.data):undefined;
 const category=parseIntent(input.name,input.city).category||input.category;
 await checkUploadOwnership(input.photos.filter(photo=>!prior?.photos.includes(photo)),who.key);
 const review=await reviewListing({...input,category});
 if(review.status==='blocked')return privateResponse({error:moderationError(review.reason)},422);
 const owned=await sellerShop(who.key),now=new Date().toISOString(),storeId=owned?.id||crypto.randomUUID();
 const old:Shop|null=owned?JSON.parse(owned.data):null;
 const suspended=owned?.visibility==='draft'&&old?.ownerConfirmed===true;
 const publish=review.status==='approved'&&!suspended;
 const sellerType=input.sellerType||old?.sellerType||(old?'business':'private');
 const companyName=input.companyName===undefined?(old?.name||''):input.companyName;
 if(sellerType==='business'&&companyName.length<2)return privateResponse({error:'Укажите название магазина или компании.'},400);
 const sellerName=input.sellerName||old?.sellerName||(old?.sellerType==='private'?old.name:'')||who.buyer.name||'Частный продавец';
 const shop:Shop={...(old||{id:storeId,category,description:'',email:'',hours:'',site:'',photos:[],status:'reference',source:'',demo:false,ownerConfirmed:false,visibility:'draft'}),sellerType,sellerName,name:sellerType==='business'?companyName:sellerName,contact:input.phone,phone:input.phone,city:input.city,street:input.street,lat:input.lat,lng:input.lng,addressConfirmed:true};
 const profileChanged=!!old&&(['name','sellerName','sellerType','phone','city','street','lat','lng'] as const).some(key=>old[key]!==shop[key]);
 const prepared=prepareProduct({storeId,name:input.name,description:input.description,category,condition:input.condition,price:input.price,priceMode:input.priceMode||'fixed',priceConfirmed:input.price!==null,quantity:prior&&prior.quantity!==0?prior.quantity:1,stockConfirmed:true,brand:prior?.brand||'',model:prior?.model||'',features:prior?.features||'',sku:prior?.sku||'',photos:input.photos,keywords:input.name,published:publish},prior,{sourceType:'manual'});
 prepared.product.id=input.id;
 const requestId=crypto.randomUUID(),data={name:shop.name,contact:shop.phone,phone:shop.phone,preferredChannel:'phone',city:shop.city,category,draftStoreId:storeId,listingId:input.id,buyerId:who.key,registeredProvider:who.buyer.provider,consent:true,consentVersion:'listing-v1',note:'Объявление: '+input.name+' · '+(input.condition==='used'?'б/у':'новый')};
 const visibility=publish?'public':'draft';
 const shopData=JSON.stringify(publish?publishedSeller(shop):{...shop,visibility,ownerConfirmed:false,submissionStatus:'pending'});
 await db().batch([
  ...(!owned?[db().prepare('INSERT INTO shops(id,owner,data,visibility) VALUES(?,?,?,?)').bind(storeId,who.key,shopData,visibility),db().prepare('INSERT INTO onboarding(store_id,created_by,created_at) VALUES(?,?,?)').bind(storeId,who.key,now)]:[]),
  ...(owned&&(profileChanged||publish&&owned.visibility!=='public')?[db().prepare('UPDATE shops SET data=?,visibility=? WHERE id=? AND owner=?').bind(suspended?JSON.stringify({...shop,visibility:'draft',ownerConfirmed:true}):shopData,visibility,storeId,who.key)]:[]),
  productWrite(db(),prepared,!!previous),
  ...(publish?[db().prepare("UPDATE connection_requests SET status='approved' WHERE json_extract(data,'$.listingId')=? AND status IN ('pending','contacted')").bind(input.id)]:[db().prepare("INSERT INTO connection_requests(id,data,status,created_at) VALUES(?,?,'pending',?)").bind(requestId,JSON.stringify(data),now)]),
  db().prepare("DELETE FROM listing_drafts WHERE owner=? AND json_extract(data,'$.id')=?").bind(who.key,input.id),
 ]);
 if(!publish&&!(process.env.NODE_ENV==='development'&&who.key==='telegram:local-demo'))await notifyConnectionRequest({id:requestId,name:shop.name,contact:shop.phone,phone:shop.phone,city:shop.city,category,catalogUrl:'',note:data.note,preferredChannel:'phone',createdAt:now}).catch(()=>null);
 return privateResponse({ok:true,id:input.id,storeId,status:publish?'published':'pending'});
}catch(error){const failure=sellerFailure(error);if(failure)return privateResponse({error:failure.error},failure.status);if(error instanceof z.ZodError)return privateResponse({error:'Добавьте фото, описание, состояние, цену, место передачи и согласие.'},400);if((error as {code?:string})?.code==='23505')return privateResponse({error:'Объявление уже сохраняется. Повторите отправку.'},409);return privateResponse({error:error instanceof Error?error.message:'Не удалось сохранить объявление'},400);}}
