import type {SearchHit,GeoPoint} from './city-search';
import {km} from './discovery';
import {cityKey} from './location';
function host(url:string|null|undefined){try{return new URL(url||'').hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
export function matchSellerLocations(offers:SearchHit[],places:SearchHit[],near?:GeoPoint){return offers.map(offer=>{
 if(offer.kind!=='product')return offer;
 if(near&&offer.sellerLocations?.length){const p=[...offer.sellerLocations].sort((a,b)=>km(near,a.point)-km(near,b.point))[0];return {...offer,address:p.address,point:p.point,phone:p.phone||offer.phone,locationSource:p.source||offer.locationSource};}
 if(offer.point)return offer;const seller=host(offer.site||offer.source);if(!seller||['t.me','telegram.me','vk.com','m.vk.com','vk.ru'].includes(seller)||seller==='makpets.ru'||seller.endsWith('.makpets.ru'))return offer;
 const candidates=places.filter(p=>{const h=host(p.site||p.shop?.site);if(offer.city&&cityKey(offer.city)!==cityKey(p.city))return false;const verified=(p.status==='organization'||p.shop?.addressConfirmed===true)&&(p.sellerLocationGroupComplete!==false||!!near);return verified&&p.point&&p.address&&h&&(h===seller||seller.endsWith('.'+h)||h.endsWith('.'+seller));});
 const unique=Array.from(new Map(candidates.map(p=>[p.address+'|'+p.point!.lat+','+p.point!.lng,p])).values());
 if(!unique.length||unique.length>1&&!near)return offer;
 // Nearest known seller branch; this does not establish branch inventory.
 const p=near?[...unique].sort((a,b)=>km(near,a.point!)-km(near,b.point!))[0]:unique[0];return {...offer,seller:offer.seller||p.shop?.name||p.title,shop:p.shop||offer.shop,city:p.city,address:p.address,point:p.point,phone:p.phone,locationSource:p.source,locationEvidence:'confirmed-point' as const,sellerLocations:unique.map(p=>({address:p.address!,point:p.point!,source:p.source})),status:'website' as const};
 });}
