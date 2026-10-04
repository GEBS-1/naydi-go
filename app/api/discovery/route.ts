import {env} from 'cloudflare:workers';
import {detectedCity} from '@/lib/location';
import {geocode} from '@/lib/osm-provider';
import {z} from 'zod';
import {sameOrigin} from '@/lib/onboarding';
import {complexRequest} from '@/lib/discovery';
import {searchLocal,guest,quota,privateResponse} from '@/lib/discovery-server';
// Kept for old clients; all external calls now go through /api/search and its budget gate.
export async function GET(req:Request){const cf=(req as Request&{cf?:{city?:string;country?:string}}).cf;let city=detectedCity(cf);if(city){try{city=(await geocode(city,true))[0]?.city||city;}catch{}}return privateResponse({city:city||null,cityDetected:!!city,citySource:city?'ip':null,ai:!!env.ROUTERAI_API_KEY,external:!!env.ROUTERAI_API_KEY&&env.ROUTERAI_WEB_MODE!=='off'});}
const input=z.object({query:z.string().trim().max(500),city:z.string().trim().min(1).max(100),near:z.object({lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180)}).optional()});
export async function POST(req:Request){try{sameOrigin(req);const b=input.parse(await req.json()),who=await guest(req);await quota(who.key,'search',100);const local=await searchLocal(b.query,b.city,b.near);return privateResponse({...local,web:[],externalStatus:'disabled-use-api-search',city:b.city,complex:complexRequest(b.query)},200,who.cookie);}catch{return privateResponse({error:'Поиск временно недоступен'},400);}}
