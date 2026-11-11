import {db} from '@/db';
import {env} from '@/lib/server-env';
import {maxApiBase} from './buyer-config';

// Transactional notices only. Registration never opts a person into marketing.
export async function notifyAccount(accountId:string,text:string,path:'/messages'|'/sell'){
 try{
  const identities=await db().prepare("SELECT provider,subject FROM buyer_identities WHERE buyer_id=? AND provider IN ('telegram','max') ORDER BY created_at").bind(accountId).all<{provider:string;subject:string}>();
  const account=await db().prepare('SELECT provider,subject FROM buyer_accounts WHERE id=?').bind(accountId).first<{provider:string;subject:string}>();
  const targets=identities.results.length?identities.results:account?[account]:[];
  // One notice, to the account's original messenger, with linked messenger as fallback.
  targets.sort((a,b)=>Number(b.provider===account?.provider)-Number(a.provider===account?.provider));
  const url=(env.AUTH_BASE_URL||'https://naydigo.prepromo.ru').replace(/\/$/,'')+path;
  for(const target of targets){
   if(!/^\d{1,20}$/.test(target.subject))continue;
   const telegram=target.provider==='telegram';
   if(telegram?!env.TELEGRAM_BOT_TOKEN:target.provider!=='max'||!env.MAX_BOT_TOKEN)continue;
   try{
    const response=await fetch(telegram?`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`:`${maxApiBase()}/messages?user_id=${encodeURIComponent(target.subject)}`,{method:'POST',headers:{'Content-Type':'application/json',...(!telegram?{Authorization:env.MAX_BOT_TOKEN!}:{})},body:JSON.stringify(telegram?{chat_id:target.subject,text,reply_markup:{inline_keyboard:[[{text:'Открыть НайдиGO',url}]]}}:{text,attachments:[{type:'inline_keyboard',payload:{buttons:[[{type:'link',text:'Открыть НайдиGO',url}]]}}]}),signal:AbortSignal.timeout(5000)});
    const result=await response.json() as {ok?:boolean;success?:boolean};
    if(response.ok&&result.ok!==false&&result.success!==false)return true;
   }catch{/* A linked messenger may still be available. */}
  }
 }catch{console.warn('Account notice unavailable');}
 return false;
}
