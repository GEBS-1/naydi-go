import {env} from 'cloudflare:workers';
import {maxApiBase} from './buyer-config';

export type ConnectionRequestNotice={
  id:string;
  name:string;
  contactPerson?:string;
  phone?:string;
  contact:string;
  city:string;
  note:string;
  preferredChannel?:'telegram'|'max'|'phone'|'email';
  category?:string;
  catalogUrl?:string;
  createdAt:string;
};

type Delivery='delivered'|'unconfigured'|'failed';

function message(item:ConnectionRequestNotice){
  const note=item.note.trim().slice(0,1200)||'Не указано';
  return [
    'Новая заявка в НайдиGo',
    '',
    `Компания: ${item.name}`,
    `Контактное лицо: ${item.contactPerson||'Не указано'}`,
    `Город: ${item.city}`,
    `Телефон: ${item.phone||'Не указан'}`,
    `Контакт: ${item.contact}`,
    `Канал ответа: ${{telegram:'Telegram',max:'MAX',phone:'Телефон',email:'Email'}[item.preferredChannel||'phone']}`,
    `Категория: ${item.category||'Не указана'}`,
    `Каталог: ${item.catalogUrl||'Не указан'}`,
    `Товары или услуги: ${note}`,
    `Получена: ${new Date(item.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}`,
    `ID: ${item.id}`,
    '',
    `${(env.AUTH_BASE_URL||'https://naydigo.prepromo.ru').replace(/\/$/,'')}/connections`,
  ].join('\n');
}

async function telegram(chatId:string|undefined,text:string){
  if(!env.TELEGRAM_BOT_TOKEN||!chatId)return false;
  const response=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true}),
    signal:AbortSignal.timeout(6000),
  });
  if(!response.ok)throw new Error('Telegram notification failed');
  const result=await response.json() as {ok?:boolean};
  if(result.ok===false)throw new Error('Telegram notification rejected');
  return true;
}

async function max(userId:string|undefined,text:string){
  if(!env.MAX_BOT_TOKEN||!userId)return false;
  const response=await fetch(`${maxApiBase()}/messages?user_id=${encodeURIComponent(userId)}`,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:env.MAX_BOT_TOKEN},
    body:JSON.stringify({text}),
    signal:AbortSignal.timeout(6000),
  });
  if(!response.ok)throw new Error('MAX notification failed');
  return true;
}

export async function notifyConnectionRequest(item:ConnectionRequestNotice):Promise<Delivery>{
  const configured=!!(env.TELEGRAM_BOT_TOKEN&&env.OWNER_TELEGRAM_CHAT_ID)||!!(env.MAX_BOT_TOKEN&&env.OWNER_MAX_USER_ID);
  if(!configured)return 'unconfigured';
  const text=message(item);
  const deliveries=await Promise.allSettled([telegram(env.OWNER_TELEGRAM_CHAT_ID,text),max(env.OWNER_MAX_USER_ID,text)]);
  return deliveries.some(result=>result.status==='fulfilled'&&result.value)?'delivered':'failed';
}

export async function sendConnectionReply(provider:string,subject:string,company:string,reply:string){
  const text=`Ответ НайдиGo по заявке «${company.slice(0,200)}»\n\n${reply.slice(0,2000)}\n\nЭто сообщение отправлено только по вашей заявке на подключение.`;
  if(provider==='telegram')return telegram(subject,text);
  if(provider==='max')return max(subject,text);
  return false;
}
