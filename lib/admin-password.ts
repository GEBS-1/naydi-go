import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {env} from '@/lib/server-env';

const cookieName='ng_moderation';
const lifetime=8*60*60;
const digest=(value:string)=>createHash('sha256').update(value).digest();

export function verifyAdminPassword(password:string){
 const secret=env.NAYDI_ADMIN_PASSWORD;
 return !!secret&&timingSafeEqual(digest(password),digest(secret));
}

function sign(value:string,secret:string){
 return createHmac('sha256',secret).update('naydigo-moderation:'+value).digest('hex');
}

export function adminPasswordSession(cookie:string|null){
 const secret=env.NAYDI_ADMIN_PASSWORD;
 const match=cookie?.match(/(?:^|;\s*)ng_moderation=(\d{10}\.[a-f0-9]{32})\.([a-f0-9]{64})(?:;|$)/);
 if(!secret||!match||Number(match[1].split('.')[0])<=Math.floor(Date.now()/1000))return false;
 return timingSafeEqual(Buffer.from(match[2],'hex'),Buffer.from(sign(match[1],secret),'hex'));
}

export function adminPasswordCookie(req:Request,clear=false){
 const value=`${Math.floor(Date.now()/1000)+lifetime}.${randomBytes(16).toString('hex')}`;
 const token=clear?'':`${value}.${sign(value,env.NAYDI_ADMIN_PASSWORD!)}`;
 const secure=!['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname);
 return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:lifetime}${secure?'; Secure':''}`;
}
