import {rankSearch,normalize} from './search';
import type {Product,Shop} from './model';
export type Offer={id:string;kind:'product'|'service';product:Product;shop:Shop;source:string;checkedAt:string|null;address:string|null;confirmed:boolean;distanceKm:number|null};
export type WebSource={title:string;url:string;description:string;checkedAt:string;status:'page-only';address:null;price:null};
export type PlanItem={id:string;category:string;name:string;query:string;note:string;enabled:boolean};
export type ShoppingPlan={id:string;title:string;city:string;task:string;items:PlanItem[];questions:string[];ai:boolean;updatedAt:string};
export type DiscoveryResult={offers:Offer[];stores:Shop[];web:WebSource[];externalStatus:string;city:string;complex:boolean};
export const safeUrl=(s:unknown)=>typeof s==='string'&&/^https?:\/\//i.test(s)?s:'';
export const complexRequest=(q:string)=>/\b/.test('')||/(вс[её]\s+для|обустро|закуп|ремонт\s+(ван|квартир|дом)|список\s+покуп|подготовить|организовать)/iu.test(q)||q.split(/[,;\n]/).filter(Boolean).length>2;
export function km(a:{lat:number;lng:number},b:{lat:number;lng:number}){const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad;return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2)));}
export function onMap(s:Shop){return s.addressConfirmed===true&&!!s.street?.trim()&&typeof s.lat==='number'&&typeof s.lng==='number'&&Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&Math.abs(s.lat)<=85&&Math.abs(s.lng)<=180;}
export function localDiscovery(products:Product[],shops:Shop[],query:string,city:string,near?:{lat:number;lng:number}){
 const stores=shops.filter(s=>s.visibility==='public'&&!s.demo&&normalize(s.city)===normalize(city));
 const publicProducts=products.filter(p=>p.published&&!p.demo&&!(p as Product&{testOnly?:boolean}).testOnly&&stores.some(s=>s.id===p.storeId));
 const matches=rankSearch(publicProducts,query);
 const offers:Offer[]=matches.map(p=>{const s=stores.find(s=>s.id===p.storeId)!;return {id:p.id,kind:p.kind||'product',product:p,shop:s,source:safeUrl(p.source)||`/#product/${encodeURIComponent(p.id)}`,checkedAt:p.checkedAt||null,address:s.street?`${s.city}, ${s.street}`:null,confirmed:p.kind!=='service'&&s.status==='connected'&&p.stockConfirmed===true&&p.quantity!==null,distanceKm:near&&onMap(s)?km(near,s):null};});
 if(near)offers.sort((a,b)=>(a.distanceKm??Infinity)-(b.distanceKm??Infinity));
 const q=normalize(query);return {offers,stores:stores.filter(s=>offers.some(o=>o.shop.id===s.id)||!q||normalize([s.name,s.category,s.description].join(' ')).includes(q))};
}
