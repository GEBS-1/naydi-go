import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {sameOrigin} from '@/lib/onboarding';
import {guest,quota,privateResponse} from '@/lib/discovery-server';
import {runSearch} from '@/lib/search-engine';
import {geocode,type Bounds} from '@/lib/osm-provider';
import {hitShop} from '@/lib/city-search';
import {km} from '@/lib/discovery';
import {distanceToPath,detourSeconds} from '@/lib/journey';
import {roadRoute} from '@/lib/journey-provider';
const point=z.object({lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180)});
const input=z.object({query:z.string().trim().min(1).max(500),city:z.string().trim().min(2).max(100).default('Казань'),start:point,end:point,mode:z.enum(['auto','pedestrian'])});
export async function GET(req:Request){try{const q=new URL(req.url).searchParams.get('q')?.trim()||'';if(q.length<3||q.length>200)return privateResponse({places:[]});const who=await guest(req);await quota(who.key,'geocode',100);return privateResponse({places:await geocode(q)},200,who.cookie);}catch{return privateResponse({error:'Подсказки адресов временно недоступны. Попробуйте через несколько секунд.'},503);}}
export async function POST(req:Request){try{
 sameOrigin(req);const b=input.parse(await req.json()),who=await guest(req);await quota(who.key,'journey',12);await quota('global','routing',40);
 if(km(b.start,b.end)>250)throw Error('В MVP доступны маршруты до 250 км по прямой. Укажите более близкий пункт.');
 const route=await roadRoute(env.VALHALLA_URL||'https://valhalla1.openstreetmap.de',[b.start,b.end],b.mode);
 const lats=route.points.map(p=>p.lat),lngs=route.points.map(p=>p.lng);
 const bounds:Bounds=[Math.min(...lats)-.04,Math.min(...lngs)-.06,Math.max(...lats)+.04,Math.max(...lngs)+.06];
 const search=await runSearch({query:b.query,city:b.city,bounds});
 const candidates=search.hits.filter(h=>h.point&&h.address).map(h=>({hit:h,d:distanceToPath(h.point!,route.points)})).filter(h=>h.d<=(b.mode==='auto'?5000:1200)).sort((a,b)=>a.d-b.d);
 const unique=Array.from(new Map(candidates.map(x=>[x.hit.point!.lat.toFixed(5)+','+x.hit.point!.lng.toFixed(5),x])).values());
 const results=[];let failed=0;
 for(const {hit} of unique.slice(0,4)){try{const via=await roadRoute(env.VALHALLA_URL||'https://valhalla1.openstreetmap.de',[b.start,hit.point!,b.end],b.mode),extraSeconds=detourSeconds(route,via);if(extraSeconds<=900)results.push({shop:hit.shop||hitShop(hit),products:hit.product?[hit.product]:[],hits:[hit],extraSeconds,via});}catch{failed++;}}
 results.sort((a,b)=>a.extraSeconds-b.extraSeconds);
 return privateResponse({route,results,failed,limited:unique.length>4,warnings:search.warnings},200,who.cookie);
 }catch(e){return privateResponse({error:e instanceof z.ZodError?'Укажите запрос и выберите адреса из подсказок.':e instanceof Error?e.message:'Маршрут временно недоступен.'},400);}}
