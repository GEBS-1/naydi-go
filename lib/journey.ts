import type {Shop} from './model';
export type Point={lat:number;lng:number};
export type TravelMode='auto'|'pedestrian';
export type RoadRoute={seconds:number;points:Point[]};
export function eligibleShop(s:Shop){return s.visibility==='public'&&!s.demo&&s.addressConfirmed===true&&!!s.street?.trim()&&typeof s.lat==='number'&&typeof s.lng==='number'&&Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&Math.abs(s.lat)<=85&&Math.abs(s.lng)<=180;}
export function decodeShape(encoded:string):Point[]{let i=0,lat=0,lng=0;const points:Point[]=[];function read(){let result=0,shift=0,b=0;do{if(i>=encoded.length||shift>30)throw new Error('Некорректная геометрия маршрута');b=encoded.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5;}while(b>=32);return result&1?~(result>>1):result>>1;}while(i<encoded.length){lat+=read();lng+=read();points.push({lat:lat/1e6,lng:lng/1e6});}return points;}
// Distance is used ONLY to shortlist stores, never to estimate travel time.
export function distanceToPath(p:Point,path:Point[]){const k=Math.cos(p.lat*Math.PI/180),project=(a:Point)=>[(a.lng-p.lng)*111320*k,(a.lat-p.lat)*111320];let min=Infinity;for(let i=1;i<path.length;i++){const a=project(path[i-1]),b=project(path[i]),dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy||1)));min=Math.min(min,Math.hypot(a[0]+t*dx,a[1]+t*dy));}return min;}
export function detourSeconds(base:RoadRoute,via:RoadRoute){if(!Number.isFinite(base.seconds)||!Number.isFinite(via.seconds)||base.seconds<0||via.seconds<0)throw new Error('Время маршрута недоступно');return Math.max(0,via.seconds-base.seconds);}
export function viaLink(start:Point,shop:Point,end:Point,mode:TravelMode){return 'https://yandex.ru/maps/?'+new URLSearchParams({rtext:[start,shop,end].map(p=>`${p.lat},${p.lng}`).join('~'),rtt:mode==='auto'?'auto':'pd'});}
