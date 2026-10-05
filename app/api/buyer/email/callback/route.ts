import {finishEmailLogin} from '@/lib/buyer-email';
import {buyerConfig} from '@/lib/buyer-config';
export async function GET(req:Request){const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'});let success=false;try{headers.append('Set-Cookie',await finishEmailLogin(req));success=true;}catch{/* Do not log or reflect one-time tokens. */}headers.set('Location',new URL(success?'/account?email_login=success':'/account?login_error=email',buyerConfig().base).href);return new Response(null,{status:303,headers});}
