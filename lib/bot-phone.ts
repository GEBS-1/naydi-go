import {createHmac,timingSafeEqual} from 'node:crypto';
import {env} from '@/lib/server-env';

export function sharedPhone(provider:'telegram'|'max',update:unknown,user:string):string|null{
 type BotContact={type?:string;payload?:{max_info?:{user_id?:unknown};vcf_info?:unknown;hash?:unknown}};
 type BotEvent={message?:{contact?:{user_id?:unknown;phone_number?:unknown};body?:{attachments?:BotContact[]}}};
 const event:BotEvent=update&&typeof update==='object'?update as BotEvent:{};
 let phone:unknown;
 if(provider==='telegram'){
  const contact=event.message?.contact;
  if(!contact||String(contact.user_id)!==user)return null;
  phone=contact.phone_number;
 }else{
  const attachments=event.message?.body?.attachments;
  const contact=Array.isArray(attachments)?attachments.find(item=>item?.type==='contact')?.payload:null;
  if(!contact||String(contact.max_info?.user_id)!==user||typeof contact.vcf_info!=='string'||contact.vcf_info.length>8000||!env.MAX_BOT_TOKEN)return null;
  if(typeof contact.hash!=='string'||!/^([a-f0-9]{64})$/i.test(contact.hash))return null;
  const vcf=contact.vcf_info.replace(/\\r\\n/g,'\r\n');
  const expected=createHmac('sha256',env.MAX_BOT_TOKEN).update(vcf).digest();
  if(!timingSafeEqual(expected,Buffer.from(contact.hash,'hex')))return null;
  const phones=[...vcf.matchAll(/^TEL(?:;[^:\r\n]*)?:([^\r\n]+)/gmi)];
  if(phones.length!==1)return null;
  phone=phones[0][1];
 }
 if(typeof phone!=='string')return null;
 const digits=phone.replace(/[^0-9]/g,'');
 return /^\d{10,15}$/.test(digits)?'+'+digits:null;
}
