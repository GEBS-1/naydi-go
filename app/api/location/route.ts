import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {guest,quota,privateResponse} from '@/lib/discovery-server';
import {sameOrigin} from '@/lib/onboarding';
import {acquireProvider,releaseProvider} from '@/lib/search-storage';
import {cleanCity} from '@/lib/location';
// POST body avoids retaining precise browser coordinates in access-log URLs.
export async function POST(req:Request){try{
 sameOrigin(req);const p=z.object({lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180)}).parse(await req.json());
 const who=await guest(req);await quota(who.key,'reverse-city',20);await quota('global','reverse-city',120);
 if(!await acquireProvider('photon',12000))return privateResponse({error:'Определение города занято. Укажите город вручную.'},503,who.cookie);
 try{const u=new URL((env.PHOTON_URL||'https://photon.komoot.io')+'/reverse');u.search=new URLSearchParams({lat:String(p.lat),lon:String(p.lng),limit:'3'}).toString();
 const r=await fetch(u,{headers:{Accept:'application/json','Accept-Language':'ru','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)'},signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error();
 const b=await r.json() as {features?:{properties:Record<string,string>}[]};
 const found=b.features?.map(f=>f.properties).find(p=>p.countrycode?.toUpperCase()==='RU'&&(p.city||['city','town','village'].includes(p.osm_value)));
 const city=cleanCity(found?.city||found?.name);return privateResponse({city:city||null,source:'geolocation'},200,who.cookie);
 }finally{await releaseProvider('photon',1200);}
 }catch{return privateResponse({error:'Не удалось определить город. Укажите его вручную.'},503);}}
