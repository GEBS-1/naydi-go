import {env} from '@/lib/server-env';
import {db} from '@/db';
import {hash} from './onboarding';
import {buyerConfig,providerReady,maxApiBase,type BuyerProvider} from './buyer-config';
import {z} from 'zod';
import {createHmac} from 'node:crypto';
import {sharedPhone} from './bot-phone';
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
  challenge=typeof b.payload==='string'&&/^[a-f0-9]{64}$/.test(b.payload)?b.payload:undefined;user=subject.parse(b.user?.user_id);chat=user;name=String(b.user?.name||b.user?.first_name||'Покупатель').slice(0,100);
 }

 async function call(method:string,body:unknown){
  const r=await fetch(provider==='telegram'?`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`:`${maxApiBase()}/${method}`,{method:'POST',headers:{'Content-Type':'application/json',...(provider==='max'?{Authorization:env.MAX_BOT_TOKEN!}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const a=await r.json() as {ok?:boolean;success?:boolean};if(!r.ok||a.ok===false||a.success===false)throw Error('Bot delivery failed');
 }
 async function send(text:string,confirm?:string,returnUrl?:string){
  const base=buyerConfig().base.replace(/\/$/,'');
  if(confirm||returnUrl){
   const label=returnUrl?'Вернуться в НайдиGO':'Подтвердить вход';
   if(provider==='telegram')await call('sendMessage',{chat_id:chat,text,reply_markup:{inline_keyboard:[[{text:label,...(returnUrl?{url:returnUrl}:{callback_data:confirm})}]]}});
   else await call('messages?user_id='+encodeURIComponent(chat),{text,attachments:[{type:'inline_keyboard',payload:{buttons:[[returnUrl?{type:'link',text:label,url:returnUrl}:{type:'callback',text:label,payload:confirm}]]}}]});
   return;
  }
  if(provider==='telegram')await call('sendMessage',{chat_id:chat,text,reply_markup:{inline_keyboard:[[{text:'Разместить товар / открыть кабинет',url:base+'/sell'}],[{text:'Найти рядом',url:base+'/#home'}],[{text:'Как войти и разместить товар',callback_data:'help'}]]}});
  else await call('messages?user_id='+encodeURIComponent(chat),{text,attachments:[{type:'inline_keyboard',payload:{buttons:[[{type:'link',text:'Разместить товар / открыть кабинет',url:base+'/sell'}],[{type:'link',text:'Найти рядом',url:base+'/#home'}],[{type:'callback',text:'Как войти и разместить товар',payload:'help'}]]}}]});
 }
 try{
  const callback=provider==='telegram'?b.callback_query:b.callback;
  const command=String(provider==='telegram'?b.message?.text||callback?.data:b.message?.body?.text||callback?.payload||'').trim().split(/\s/)[0].split('@')[0];
  const isContact=provider==='telegram'?!!b.message?.contact:b.message?.body?.attachments?.some((item:{type?:string})=>item.type==='contact');
  if(isContact){
   const phone=sharedPhone(provider,b,user);
   const identity=await db().prepare('SELECT buyer_id FROM buyer_identities WHERE provider=? AND subject=?').bind(provider,user).first<{buyer_id:string}>();
   if(!phone||!identity){
    await send('Не удалось подтвердить ваш номер. Начните вход на сайте и используйте кнопку «Поделиться номером» в этом боте.');
    return Response.json({ok:true});
   }
   await db().prepare('INSERT INTO buyer_contact_phones(buyer_id,phone,provider,updated_at) VALUES(?,?,?,?) ON CONFLICT(buyer_id) DO UPDATE SET phone=excluded.phone,provider=excluded.provider,updated_at=excluded.updated_at').bind(identity.buyer_id,phone,provider,Date.now()).run();
   if(provider==='telegram')await call('sendMessage',{chat_id:chat,text:'Номер сохранён. Вернитесь в форму и проверьте поле телефона.',reply_markup:{remove_keyboard:true}});
   await send('Номер сохранён в вашем аккаунте НайдиGO. Перед публикацией проверьте контакт в форме.',undefined,buyerConfig().base.replace(/\/$/,'')+'/sell');
   return Response.json({ok:true});
  }
  const phoneRequest=command==='/phone'||provider==='telegram'&&/^\/start(?:@\w+)?\s+phone$/.test(String(b.message?.text||''))||provider==='max'&&b.payload==='phone';
  if(phoneRequest){
   const identity=await db().prepare('SELECT buyer_id FROM buyer_identities WHERE provider=? AND subject=?').bind(provider,user).first();
   if(!identity){await send('Сначала войдите в НайдиGO с сайта. После входа можно передать номер в профиль.');return Response.json({ok:true});}
   const text='Нажмите «Поделиться номером», чтобы подставить контакт в форму НайдиGO. Перед отправкой объявления вы сможете его проверить и изменить.';
   if(provider==='telegram')await call('sendMessage',{chat_id:chat,text,reply_markup:{keyboard:[[{text:'Поделиться номером',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}});
   else await call('messages?user_id='+encodeURIComponent(chat),{text,attachments:[{type:'inline_keyboard',payload:{buttons:[[{type:'request_contact',text:'Поделиться номером'}]]}}]});
   return Response.json({ok:true});
  }
  async function acknowledge(text:string){if(callback)try{await call(provider==='telegram'?'answerCallbackQuery':'answers?callback_id='+encodeURIComponent(callback.callback_id),provider==='telegram'?{callback_query_id:callback.id,text:text.slice(0,190)}:{notification:text});}catch{console.warn('Bot callback acknowledgement unavailable',provider);}}
  if(command==='/help'||command==='help'){
   await acknowledge('Как пользоваться НайдиGO');
   await send('Как разместить товар:\n\n1. Нажмите «Разместить товар / открыть кабинет».\n2. На сайте примите условия и выберите вход через '+(provider==='telegram'?'Telegram':'MAX')+'.\n3. Перейдите по ссылке с сайта в этот бот и нажмите «Подтвердить вход».\n4. Вернитесь в ту же вкладку браузера — форма откроется автоматически.\n5. Добавьте фото. Найди-помощник поможет с названием и описанием. Проверьте цену, контакт и точку на карте.\n6. Отправьте карточку на проверку. После одобрения она появится в поиске.\n\nДля магазина отметьте в форме «Продаю от магазина или компании». Отдельно создавать магазин не нужно.\n\nЕсли вход не продолжился, начните его заново на сайте. Само нажатие «Старт» без ссылки с сайта не выполняет вход.');return Response.json({ok:true});
  }
  if(command==='/id'){
   await send(`Ваш личный ${provider==='telegram'?'Telegram chat ID':'MAX user ID'}: ${chat}\n\nДобавьте его на сервере как ${provider==='telegram'?'OWNER_TELEGRAM_CHAT_ID':'OWNER_MAX_USER_ID'}, чтобы получать личные уведомления о новых заявках магазинов.`);
   return Response.json({ok:true});
  }
  if(command==='/subscribe'||command==='/stop'){
   await db().prepare('INSERT INTO bot_news_consent(provider,subject,subscribed,updated_at,consent_version) VALUES(?,?,?,?,?) ON CONFLICT(provider,subject) DO UPDATE SET subscribed=excluded.subscribed,updated_at=excluded.updated_at,consent_version=excluded.consent_version').bind(provider,user,command==='/subscribe'?1:0,Date.now(),'news-v1').run();
   await send(command==='/subscribe'?'Вы подписались на новости, советы и предложения НайдиGo в этом боте, не чаще одного сообщения в день. Отписаться в любой момент: /stop. Вход и бесплатные поиски не зависят от подписки.':'Рассылка отключена. Аккаунт и поиск продолжают работать.');return Response.json({ok:true});
  }
  if(!challenge){await acknowledge('Откройте сайт, чтобы начать вход');await send('Добро пожаловать в НайдиGo! Помогу найти товары рядом или разместить ваше предложение.\n\nДля размещения нажмите кнопку ниже. На сайте выберите вход через '+(provider==='telegram'?'Telegram':'MAX')+' — я пришлю кнопку подтверждения. После подтверждения вернитесь в ту же вкладку сайта.\n\nФото → подсказки помощника → цена и место → отправка на проверку. Для человека и магазина одна форма.\n\nПоиск и маршруты доступны без регистрации. Этот бот подтверждает вход; помощник по заполнению работает на сайте.\n\n/help — инструкция\n/subscribe — подписаться на новости\n/stop — отключить рассылку');return Response.json({ok:true});}
  const key=await hash(challenge);
  const row=await db().prepare('SELECT subject,consumed FROM buyer_logins WHERE hash=? AND provider=? AND expires_at>?').bind(key,provider,Date.now()).first<{subject:string|null;consumed:number}>();
  const notice='Ссылка устарела. Начните вход на сайте заново.';
  if(row&&(!row.subject||row.subject===user)){
   if(callback&&row.subject===user&&!row.consumed){
    const returnSecret=createHmac('sha256',secret).update('naydi-login-return:'+challenge).digest('hex');
    const confirmed=await db().prepare('UPDATE buyer_logins SET code_hash=? WHERE hash=? AND subject=? AND consumed=0 AND expires_at>?').bind('bot-return-v1:'+await hash(returnSecret),key,user,Date.now()).run();
    if(confirmed.meta.changes){
     const url=new URL('/sell',buyerConfig().base);
     url.hash='login='+challenge+'.'+returnSecret;
     await acknowledge('Вход подтверждён');
     await send('Здравствуйте! Вход подтверждён. Нажмите кнопку, чтобы вернуться в НайдиGO.',undefined,url.toString());
     return Response.json({ok:true});
    }
   }else if(!callback&&!row.consumed){
    await db().prepare('UPDATE buyer_logins SET subject=?,name=? WHERE hash=? AND (subject IS NULL OR subject=?) AND consumed=0').bind(user,name,key,user).run();
    await send('Здравствуйте! Если вы начали вход на сайте НайдиGO, подтвердите его.',challenge);
    return Response.json({ok:true});
   }
  }
  await acknowledge(notice);
  await send(notice);return Response.json({ok:true});
 }catch{return new Response('Retry',{status:503});}
}
