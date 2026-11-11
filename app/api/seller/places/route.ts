import {z} from 'zod';
import {guest,quota,privateResponse} from '@/lib/discovery-server';
import {geocode} from '@/lib/osm-provider';
import {cityKey} from '@/lib/location';
import {km} from '@/lib/discovery';

export async function GET(req:Request){
 try{
  const params=new URL(req.url).searchParams;
  const input=z.object({kind:z.enum(['city','address']),q:z.string().trim().min(2).max(150),city:z.string().trim().max(100),area:z.string().max(400),lat:z.coerce.number().min(-85).max(85).optional(),lng:z.coerce.number().min(-180).max(180).optional()}).parse({
   kind:params.get('kind'),q:params.get('q'),city:params.get('city')||'',area:params.get('area')||'',
   lat:params.has('lat')?params.get('lat'):undefined,lng:params.has('lng')?params.get('lng'):undefined,
  });
  const who=await guest(req);
  await quota(who.key,'seller-places',100);
  if(input.kind==='city'){
   const places=await geocode(input.q,true);
   const unique=new Set<string>();
   return privateResponse({places:places.filter(place=>{
    if(/^(?:городской округ|муниципальн|район)/iu.test(place.city||''))return false;
    const key=place.city+'|'+place.region;
    if(unique.has(key))return false;
    unique.add(key);
    return true;
   }).map(place=>({...place,label:[place.city,place.region].filter(Boolean).join(', ')}))},200,who.cookie);
  }
  if(!input.city)return privateResponse({error:'Сначала выберите город.'},400);
  const places=await geocode((input.area||input.city)+', '+input.q);
  const streets=new Set<string>();
  return privateResponse({places:places.filter(place=>{
   if(!place.street||cityKey(place.city||'')!==cityKey(input.city))return false;
   if(input.lat!==undefined&&input.lng!==undefined&&km(place,{lat:input.lat,lng:input.lng})>100)return false;
   const key=place.street.toLocaleLowerCase('ru');
   if(streets.has(key))return false;
   streets.add(key);
   return true;
  })
   .map(place=>({...place,label:place.street,city:input.city}))},200,who.cookie);
 }catch(e){
  return privateResponse({error:e instanceof z.ZodError?'Введите хотя бы две буквы.':'Подсказки временно недоступны. Попробуйте ещё раз.'},e instanceof z.ZodError?400:503);
 }
}
