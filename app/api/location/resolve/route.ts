import {z} from 'zod';
import {sameOrigin} from '@/lib/onboarding';
import {quota,guest,privateResponse} from '@/lib/discovery-server';
import {queryCity} from '@/lib/query-city';
export async function POST(req:Request){try{sameOrigin(req);const {query}=z.object({query:z.string().max(500)}).parse(await req.json());const who=await guest(req);await quota(who.key,'query-city',40);return privateResponse({location:await queryCity(query)},200,who.cookie);}catch{return privateResponse({error:'Не удалось определить город. Выберите вручную.'},400);}}
