import type {SearchHit} from './city-search';
function host(url:string|null){try{return new URL(url||'').hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
export function matchSellerLocations(offers:SearchHit[],places:SearchHit[]){return offers.map(offer=>{
 if(offer.kind!=='product'||offer.point)return offer;const seller=host(offer.site||offer.source);if(!seller)return offer;
 const candidates=places.filter(p=>{const h=host(p.site);return p.status==='organization'&&p.point&&p.address&&h&&(h===seller||seller.endsWith('.'+h)||h.endsWith('.'+seller));});
 const unique=Array.from(new Map(candidates.map(p=>[p.address+'|'+p.point!.lat+','+p.point!.lng,p])).values());
 if(unique.length!==1)return offer; // Never choose a random branch of a chain.
 const p=unique[0];return {...offer,city:p.city,address:p.address,point:p.point,phone:p.phone,locationSource:p.source,locationEvidence:'confirmed-point' as const,status:'website' as const};
 });}
