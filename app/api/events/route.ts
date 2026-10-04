import {z} from 'zod';
import {sameOrigin,hash} from '@/lib/onboarding';
import {guest,quota,privateResponse} from '@/lib/discovery-server';
import {db} from '@/db';
export async function POST(req:Request){try{sameOrigin(req);const raw=await req.text();if(raw.length>1000)return privateResponse({error:'Слишком большой запрос'},413);const body=z.object({event:z.enum(['visit','seller','route','favorite','saved_search']),city:z.string().max(100),category:z.string().max(100)}).parse(JSON.parse(raw));const who=await guest(req);await quota(who.key,'events',120);const monthActor=await hash(new Date().toISOString().slice(0,7)+':'+who.key);await db().prepare('INSERT INTO product_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),body.event,body.city,body.category,monthActor,Date.now()).run();return privateResponse({ok:true},200,who.cookie);}catch{return privateResponse({error:'Событие не записано'},400);}}
