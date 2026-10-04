import {finishYandex} from '@/lib/buyer-yandex';
import {buyerCookie} from '@/lib/buyer-auth';
import {buyerConfig} from '@/lib/buyer-config';
export async function GET(req:Request){
 const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 let success=false;
 try{headers.append('Set-Cookie',await finishYandex(req));success=true;}catch{/* Never log callback codes, provider response or tokens. */}
 headers.append('Set-Cookie',buyerCookie('ng_yandex','',0));
 headers.set('Location',new URL(success?'/account':'/account?login_error=yandex',buyerConfig().base).href);
 return new Response(null,{status:303,headers});
}
