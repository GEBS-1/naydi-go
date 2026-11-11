import {z} from 'zod';
import {sameOrigin} from '@/lib/onboarding';
import {guest,quota,privateResponse} from '@/lib/discovery-server';
import {env} from '@/lib/server-env';
import {cacheRead,cacheWrite,acquireProvider,releaseProvider} from '@/lib/search-storage';
import {km} from '@/lib/discovery';

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const input=z.object({lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180)}).parse(await req.json());
  const who=await guest(req);await quota(who.key,'seller-address',60);
  // Address-level precision: never reuse the city cache for a selected building.
  const key=`seller:reverse:v1:${input.lat.toFixed(5)}:${input.lng.toFixed(5)}`;
  const cached=await cacheRead<{address:string;city:string;region:string}|false>(key);
  if(cached!==null)return privateResponse({place:cached?{...cached,...input}:null},200,who.cookie);
  if(!await acquireProvider('photon',12000))return privateResponse({error:'Поиск адреса занят. Попробуйте ещё раз.'},503,who.cookie);
  try{
   const url=new URL((env.PHOTON_URL||'https://photon.komoot.io')+'/reverse');
   url.search=new URLSearchParams({lat:String(input.lat),lon:String(input.lng),limit:'5'}).toString();
   const response=await fetch(url,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)'}});
   if(!response.ok)throw Error('provider');
   const data=await response.json() as {features?:{geometry:{coordinates:number[]};properties:Record<string,string>}[]};
   const found=data.features?.filter(f=>f.properties.countrycode?.toUpperCase()==='RU'&&f.properties.street&&f.properties.housenumber&&km(input,{lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]})<0.08)
    .sort((a,b)=>km(input,{lat:a.geometry.coordinates[1],lng:a.geometry.coordinates[0]})-km(input,{lat:b.geometry.coordinates[1],lng:b.geometry.coordinates[0]}))[0];
   const p=found?.properties;
   const place=p?{address:`${p.street}, ${p.housenumber}`,city:p.city||p.town||p.village||'',region:p.state||''}:false;
   await cacheWrite(key,place,86400000);
   return privateResponse({place:place?{...place,...input}:null},200,who.cookie);
  }finally{await releaseProvider('photon',1200);}
 }catch(e){return privateResponse({error:e instanceof z.ZodError?'Не удалось выбрать точку.':'Адрес временно не определяется. Повторите или укажите вручную.'},e instanceof z.ZodError?400:503);}
}
