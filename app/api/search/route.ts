import {z} from 'zod';
import {sameOrigin} from '@/lib/onboarding';
import {guest,quota,privateResponse} from '@/lib/discovery-server';
import {runSearch} from '@/lib/search-engine';
const input=z.object({query:z.string().trim().max(500),city:z.string().trim().min(2).max(100),context:z.object({query:z.string().max(500),maxPrice:z.number().min(0).max(1e9).optional(),radiusKm:z.number().min(0).max(100).optional(),sort:z.enum(['relevance','price']).optional(),newOnly:z.boolean().optional()}).optional(),near:z.object({lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180)}).optional()});
export async function POST(req:Request){try{sameOrigin(req);const body=input.parse(await req.json()),who=await guest(req);await quota(who.key,'unified-search',80);await quota('global','unified-search',300);
 if(!req.headers.get('accept')?.includes('application/x-ndjson'))return privateResponse(await runSearch(body),200,who.cookie);
 const encoder=new TextEncoder();let active=true;const stream=new ReadableStream({async start(controller){try{await runSearch(body,r=>{if(active)controller.enqueue(encoder.encode(JSON.stringify(r)+'\n'));});}catch{if(active)controller.enqueue(encoder.encode(JSON.stringify({error:'Поиск временно недоступен. Попробуйте ещё раз.'})+'\n'));}finally{if(active)controller.close();}},cancel(){active=false;}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(who.cookie?{'Set-Cookie':who.cookie}:{})}});
 }catch{return privateResponse({error:'Не удалось выполнить поиск. Проверьте город и запрос или повторите позже.'},400);}}
