import {db} from '@/db';
import {buyerIdentity} from './buyer-auth';
// No paid quality degradation, and no unimplemented paid AI promises.
export async function buyerEntitlements(req:Request){const user=await buyerIdentity(req);const pro=user?await db().prepare("SELECT id FROM buyer_grants WHERE buyer_id=? AND kind='pro' AND remaining>0 AND expires_at>? LIMIT 1").bind(user.id,Date.now()).first():null;return {tier:pro?'Pro':'Free',features:{search:true,map:true,personalSync:!!user,advancedAgent:false},photoPerHour:3};}
