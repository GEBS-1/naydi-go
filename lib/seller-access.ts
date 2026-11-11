import {isSellerProvider} from '@/lib/seller-providers';
import {buyerIdentity} from './buyer-auth';
import {db} from '@/db';

export class SellerAccessError extends Error{constructor(message:string,public status=401){super(message);}}
export function socialSeller(id:string){return /^(telegram|max):[^:]+$/.test(id);}
export async function sellerIdentity(req:Request){
 const buyer=await buyerIdentity(req);
 if(!buyer||!isSellerProvider(buyer.provider)||!socialSeller(buyer.id))throw new SellerAccessError('Войдите через Telegram или MAX, чтобы создать магазин.');
 return {key:buyer.id,buyer,cookie:null};
}
export async function sellerShop(key:string){return db().prepare('SELECT id,data,visibility FROM shops WHERE owner=? LIMIT 1').bind(key).first<{id:string;data:string;visibility:string}>();}
export async function assertSingleSellerShop(key:string,id?:string){
 const existing=await sellerShop(key);
 if(existing&&existing.id!==id)throw new SellerAccessError('К аккаунту уже привязан магазин. Откройте его: один аккаунт — одна организация и одна точка на карте.',409);
}
export function sellerFailure(error:unknown){
 if(error instanceof SellerAccessError)return {error:error.message,status:error.status};
 if(error instanceof Error&&/UNIQUE constraint failed: shops.owner|idx_shops_single_social_owner/.test(error.message))return {error:'К аккаунту уже привязан магазин. Вторую организацию создать нельзя.',status:409};
 return null;
}
