import {db} from '@/db';
import type {GeoPoint,SearchHit} from './city-search';
import {normalize} from './search';
import {attachCatalogLocations} from './catalog-locations';
import {discoveredSourceKey,persistableDiscoveredOffer,selectDiscoveredOffers} from './discovered-offer-contract';

const MAX_OFFERS_PER_SEARCH=40;
export async function readDiscoveredOffers(city:string,query:string,near?:GeoPoint){
 const rows=await db().prepare('SELECT data FROM discovered_offers WHERE city=? AND checked_at>=? ORDER BY checked_at DESC LIMIT 500')
  .bind(normalize(city),Date.now()-24*60*60_000).all<{data:string}>();
 const hits:SearchHit[]=[];
 for(const row of rows.results){try{hits.push(JSON.parse(row.data) as SearchHit);}catch{/* Ignore a single malformed legacy row. */}}
 // Cached offers may have been discovered from another user's location. Reattach
 // a catalog seller's verified location for this request before ranking/routes;
 // otherwise a cached product can keep a stale branch and show the wrong distance.
 return selectDiscoveredOffers(attachCatalogLocations(hits,near),query,city,near);
}

export async function persistDiscoveredOffers(city:string,hits:SearchHit[]){
 const eligible=hits.filter(hit=>persistableDiscoveredOffer(hit,city)).slice(0,MAX_OFFERS_PER_SEARCH);
 if(!eligible.length)return 0;
 const statements=eligible.map(hit=>db().prepare(
  'INSERT INTO discovered_offers(id,city,source_key,source_url,data,checked_at) VALUES(?,?,?,?,?,?) ON CONFLICT(city,source_key) DO UPDATE SET source_url=excluded.source_url,data=excluded.data,checked_at=excluded.checked_at'
 ).bind(crypto.randomUUID(),normalize(city),discoveredSourceKey(hit.source),hit.source,JSON.stringify({...hit,distanceKm:null}),Date.parse(hit.checkedAt)));
 await db().batch(statements);
 // This table is only a refreshable public-offer index; keep it bounded without touching user-owned products.
 await db().prepare('DELETE FROM discovered_offers WHERE checked_at<?').bind(Date.now()-90*24*60*60_000).run();
 return eligible.length;
}
