import {z} from 'zod';
import {sameOrigin} from '@/lib/onboarding';
import {guest,privateResponse,quota} from '@/lib/discovery-server';
import {searchDetails} from '@/lib/search-details';

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const who=await guest(req);
  const {key}=z.object({key:z.string().regex(/^[a-f0-9]{64}$/)}).parse(await req.json());
  await quota(who.key,'search-details',100);
  const details=await searchDetails(key);
  return details?privateResponse(details):privateResponse({error:'Обновите поиск, чтобы открыть контакты.'},404);
 }catch{return privateResponse({error:'Не удалось открыть контакты. Попробуйте ещё раз.'},400);}
}
