import {z} from 'zod';
import {quota,privateResponse} from '@/lib/discovery-server';
import {sameOrigin} from '@/lib/onboarding';
import {adminPasswordCookie,verifyAdminPassword} from '@/lib/admin-password';

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const {password}=z.object({password:z.string().min(1).max(256)}).parse(await req.json());
  if(!verifyAdminPassword(password)){
   try{await quota('global','admin-password-invalid',50);}catch{return privateResponse({error:'Слишком много попыток. Попробуйте позже.'},429);}
   return privateResponse({error:'Неверный пароль'},401);
  }
  const response=privateResponse({ok:true});
  response.headers.set('Set-Cookie',adminPasswordCookie(req));
  return response;
 }catch{return privateResponse({error:'Не удалось выполнить вход'},400);}
}

export async function DELETE(req:Request){
 try{
  sameOrigin(req);
  const response=privateResponse({ok:true});
  response.headers.set('Set-Cookie',adminPasswordCookie(req,true));
  return response;
 }catch{return privateResponse({error:'Не удалось выйти'},403);}
}
