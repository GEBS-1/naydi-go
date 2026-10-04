import {env} from 'cloudflare:workers';
import {db} from '@/db';
import {hash} from './onboarding';
import {buyerConfig,providerReady,maxApiBase,type BuyerProvider} from './buyer-config';
import {z} from 'zod';
const subject=z.union([z.number().int().safe(),z.string().regex(/^\d{1,20}$/)]).transform(String);
export async function buyerBotWebhook(req:Request,provider:BuyerProvider){
 if(!providerReady(provider))return new Response('Unavailable',{status:503});
 const secret=provider==='telegram'?env.TELEGRAM_WEBHOOK_SECRET:env.MAX_WEBHOOK_SECRET;
 const provided=req.headers.get(provider==='telegram'?'x-telegram-bot-api-secret-token':'x-max-bot-api-secret');
 if(!provided||!secret||await hash(provided)!==await hash(secret))return new Response('Forbidden',{status:403});
 const raw=await req.text();if(raw.length>32000)return new Response('Too large',{status:413});
 let challenge:string|undefined,user:string,name:string,chat:string;
 const b=JSON.parse(raw);
 if(provider==='telegram'){
  const cb=b.callback_query;const m=cb?{chat:cb.message?.chat,from:cb.from,text:'/start '+cb.data}:b.message;if(m?.chat?.type!=='private'||m?.from?.is_bot)return Response.json({ok:true});
  challenge=String(m.text||'').match(/^\/start(?:@\w+)?\s+([a-f0-9]{64})$/)?.[1];user=subject.parse(m.from.id);chat=subject.parse(m.chat.id);if(user!==chat)return Response.json({ok:true});name=String(m.from.first_name||'Покупатель').slice(0,100);
 }else{
  if(!['bot_started','message_callback','message_created'].includes(b.update_type))return Response.json({ok:true});
  if(b.update_type==='message_callback'){b.user=b.callback?.user;b.payload=b.callback?.payload;}
  if(b.update_type==='message_created'){if(b.message?.recipient?.chat_type!=='dialog')return Response.json({ok:true});b.user=b.message?.sender;b.payload=String(b.message?.body?.text||'').match(/^\/start\s+([a-f0-9]{64})$/)?.[1];}
  if(b.user?.is_bot)return Response.json({ok:true});
  challenge=typeof b.payload==='string'&&/^[a-f0-9]{64}$/.test(b.payload)?b.payload:undefined;user=subject.parse(b.user?.user_id);chat=user;name=String(b.user?.name||'Покупатель').slice(0,100);
 }

 async function call(method:string,body:unknown){
  const r=await fetch(provider==='telegram'?`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`:`${maxApiBase()}/${method}`,{method:'POST',headers:{'Content-Type':'application/json',...(provider==='max'?{Authorization:env.MAX_BOT_TOKEN!}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const a=await r.json() as {ok?:boolean;success?:boolean};if(!r.ok||a.ok===false||a.success===false)throw Error('Bot delivery failed');
 }
 async function send(text:string,confirm?:string){
  const url=buyerConfig().base.replace(/\/$/,'')+'/account';
  if(provider==='telegram')await call('sendMessage',{chat_id:chat,text,reply_markup:{inline_keyboard:[...(confirm?[[{text:'Подтвердить вход',callback_data:confirm}]]:[]),[{text:'Открыть НайдиGo',url}]]}});
  else await call('messages?user_id='+encodeURIComponent(chat),{text,attachments:[{type:'inline_keyboard',payload:{buttons:[...(confirm?[[{type:'callback',text:'Подтвердить вход',payload:confirm}]]:[]),[{type:'link',text:'Открыть НайдиGo',url}]]}}]});
 }
 try{
  const command=String(provider==='telegram'?b.message?.text:b.message?.body?.text||'').trim().split(/\s/)[0].split('@')[0];
  if(command==='/id'){
   await send(`Ваш личный ${provider==='telegram'?'Telegram chat ID':'MAX user ID'}: ${chat}\n\nДобавьте его на сервере как ${provider==='telegram'?'OWNER_TELEGRAM_CHAT_ID':'OWNER_MAX_USER_ID'}, чтобы получать личные уведомления о новых заявках магазинов.`);
   return Response.json({ok:true});
  }
  if(command==='/subscribe'||command==='/stop'){
   await db().prepare('INSERT INTO bot_news_consent(provider,subject,subscribed,updated_at,consent_version) VALUES(?,?,?,?,?) ON CONFLICT(provider,subject) DO UPDATE SET subscribed=excluded.subscribed,updated_at=excluded.updated_at,consent_version=excluded.consent_version').bind(provider,user,command==='/subscribe'?1:0,Date.now(),'news-v1').run();
   await send(command==='/subscribe'?'Вы подписались на новости, советы и предложения НайдиGo в этом боте, не чаще одного сообщения в день. Отписаться в любой момент: /stop. Вход и бесплатные поиски не зависят от подписки.':'Рассылка отключена. Аккаунт и поиск продолжают работать.');return Response.json({ok:true});
  }
  if(!challenge){await send('Добро пожаловать в НайдиGo! Откройте сайт и выберите вход через '+(provider==='telegram'?'Telegram':'MAX')+'. Затем подтвердите вход здесь одной кнопкой — без пароля и кода. Искать товары можно и без регистрации.\n\n/id — показать ваш личный ID для настройки уведомлений.\n/subscribe — согласиться получать новости и предложения.\n/stop — отключить рассылку.');return Response.json({ok:true});}
  const key=await hash(challenge),callback=provider==='telegram'?b.callback_query:b.callback;
  const row=await db().prepare('SELECT subject,consumed FROM buyer_logins WHERE hash=? AND provider=? AND expires_at>?').bind(key,provider,Date.now()).first<{subject:string|null;consumed:number}>();
  let notice='Ссылка устарела. Начните вход на сайте заново.';
  if(row&&(!row.subject||row.subject===user)){
   if(callback&&row.subject===user){
    await db().prepare("UPDATE buyer_logins SET code_hash='bot-confirmed-v1' WHERE hash=? AND subject=? AND consumed=0 AND expires_at>?").bind(key,user,Date.now()).run();
    notice='Вход подтверждён. Вернитесь в браузер, где начали вход — аккаунт подключится автоматически. Код вводить не нужно.';
   }else if(!callback&&!row.consumed){
    await db().prepare('UPDATE buyer_logins SET subject=?,name=? WHERE hash=? AND (subject IS NULL OR subject=?) AND consumed=0').bind(user,name,key,user).run();
    await send('Подтвердить вход в НайдиGo? Нажимайте только если вы сами начали вход на naydigo.prepromo.ru. Вход не подписывает вас на рассылки.',challenge);
    return Response.json({ok:true});
   }
  }
  if(callback)await call(provider==='telegram'?'answerCallbackQuery':'answers?callback_id='+encodeURIComponent(callback.callback_id),provider==='telegram'?{callback_query_id:callback.id,text:notice.slice(0,190)}:{notification:notice});
  await send(notice);return Response.json({ok:true});
 }catch{return new Response('Retry',{status:503});}
}
