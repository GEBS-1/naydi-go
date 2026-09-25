import {recordFreeCall} from './api-budget';
import {decodeShape,type Point,type RoadRoute,type TravelMode} from './journey';
// Keep no request-owned promises/timers across Worker requests. Production needs
// a shared provider quota; this bounded per-isolate limiter serves local demos.
let nextSlot=0;
export async function providerFetch<T>(url:string,init?:RequestInit):Promise<T>{
 const wait=Math.max(0,nextSlot-Date.now());
 if(wait>5000)throw new Error('Сервис маршрутов занят. Повторите поиск через несколько секунд.');
 nextSlot=Date.now()+wait+1100;
 if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
 const began=performance.now();let success=false;
 try{const response=await fetch(url,{...init,headers:{'User-Agent':'NaydiGo-local-prototype/1.0','Accept':'application/json',...init?.headers},signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error('provider unavailable');const data=await response.json() as T;success=true;return data;}
 catch{throw new Error('Картографический сервис временно недоступен. Попробуйте позже или используйте обычный поиск.');}finally{await recordFreeCall('valhalla',performance.now()-began,success?'complete':'error');}
}
export async function roadRoute(base:string,points:Point[],mode:TravelMode):Promise<RoadRoute>{const body=await providerFetch<{trip:{status:number;summary:{time:number};legs:{shape:string}[]}}>(base.replace(/\/$/,'')+'/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locations:points.map(p=>({lat:p.lat,lon:p.lng,type:'break'})),costing:mode,units:'kilometers',directions_type:'none'})});const trip=body.trip;if(trip?.status!==0||!Number.isFinite(trip?.summary?.time)||!Array.isArray(trip?.legs))throw new Error('Не удалось построить маршрут между выбранными точками. Выберите другие адреса.');const shape=trip.legs.flatMap((leg:{shape:string})=>decodeShape(leg.shape));if(shape.length<2)throw new Error('Сервис не вернул линию маршрута');return {seconds:trip.summary.time,points:shape};}
