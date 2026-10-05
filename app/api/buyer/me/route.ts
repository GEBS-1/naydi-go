import {guest} from '@/lib/discovery-server';
import {buyerEntitlements} from '@/lib/buyer-entitlements';
import {yandexReady} from '@/lib/buyer-yandex';
import {buyerIdentity} from '@/lib/buyer-auth';
import {buyerConfig,providerReady} from '@/lib/buyer-config';
import {buyerBalance} from '@/lib/buyer-credits';
import {db} from '@/db';
import {emailReady} from '@/lib/buyer-email';
export async function GET(req:Request){try{const config=buyerConfig(),user=await buyerIdentity(req),visitor=await guest(req);const balance=await buyerBalance(user?.id||'guest:'+visitor.key);const orders=user?(await db().prepare('SELECT id,amount,status,test,created_at FROM buyer_payments WHERE buyer_id=? ORDER BY created_at DESC LIMIT 10').bind(user.id).all()).results:[];return Response.json({user,entitlements:await buyerEntitlements(req),providers:{email:emailReady(),yandex:yandexReady(),telegram:providerReady('telegram'),max:providerReady('max')},balance:balance.length?balance:!user?[{kind:'free',remaining:10,expiresAt:null}]:[],orders,free:config.free,pro:config.pro,payments:config.payments,test:config.test,quota:config.quota},{headers:{'Cache-Control':'no-store',...(!user&&visitor.cookie?{'Set-Cookie':visitor.cookie}:{})}});}catch{return Response.json({error:'Аккаунт временно недоступен'},{status:503});}}
