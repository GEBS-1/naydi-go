import {normalize} from './search';
import {relevantOffers} from './offer-relevance';
import type {GeoPoint,SearchHit} from './city-search';

export const DISCOVERED_OFFER_MAX_AGE_MS=24*60*60_000;
const TRACKING=/^(?:utm_.+|yclid|gclid|fbclid|from|ysclid)$/i;
function nearbyLocationAllowed(hit:SearchHit){
 try{return !['makpets.ru','www.makpets.ru'].includes(new URL(hit.source||hit.site||'').hostname.toLowerCase());}catch{return false;}
}

export function discoveredSourceKey(value:string){
 try{
  const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
  url.hash='';for(const key of [...url.searchParams.keys()])if(TRACKING.test(key))url.searchParams.delete(key);
  url.searchParams.sort();url.hostname=url.hostname.toLowerCase();url.pathname=url.pathname.replace(/\/+$/,'')||'/';
  return url.toString();
 }catch{return null;}
}

export function persistableDiscoveredOffer(hit:SearchHit,city:string){
 const checked=Date.parse(hit.checkedAt||'');
 return hit.kind==='product'&&hit.status!=='seller-confirmed'&&!hit.product&&nearbyLocationAllowed(hit)&&hit.locationEvidence==='confirmed-point'&&!!hit.point&&Number.isFinite(hit.point.lat)&&Math.abs(hit.point.lat)<=85&&Number.isFinite(hit.point.lng)&&Math.abs(hit.point.lng)<=180&&!!hit.address&&
  normalize(hit.city)===normalize(city)&&!!discoveredSourceKey(hit.source)&&Number.isFinite(checked)&&checked>0;
}

export function selectDiscoveredOffers(hits:SearchHit[],query:string,city:string,near?:GeoPoint,now=Date.now()){
 const fresh=hits.filter(hit=>persistableDiscoveredOffer(hit,city)&&now-Date.parse(hit.checkedAt)<=DISCOVERED_OFFER_MAX_AGE_MS&&Date.parse(hit.checkedAt)<=now+5*60_000);
 const unique=new Map<string,SearchHit>();
 for(const hit of fresh){const key=discoveredSourceKey(hit.source)!;const previous=unique.get(key);if(!previous||Date.parse(hit.checkedAt)>Date.parse(previous.checkedAt))unique.set(key,hit);}
 return relevantOffers([...unique.values()],query,city).map(hit=>({ ...hit,distanceKm:near&&hit.point?distanceKm(near,hit.point):null }));
}

function distanceKm(a:GeoPoint,b:GeoPoint){
 const radians=Math.PI/180,lat=(b.lat-a.lat)*radians,lng=(b.lng-a.lng)*radians;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(lat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(lng/2)**2)));
}
