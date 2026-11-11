import {routerWebProvider} from './router-web-provider';
import {deduplicate} from './city-search';
import {resolveSearch} from './search-context';
import type {SearchHit,GeoPoint} from './city-search';
export interface WebSearchProvider {name:string;search(query:string,city:string,near?:GeoPoint,nearArea?:string|null,onPartial?:(hits:SearchHit[])=>void|Promise<void>):Promise<SearchHit[]>;}
export function webProvider():WebSearchProvider|null{return routerWebProvider();}
export async function searchWeb(query:string,city:string,catalogHits?:SearchHit[],near?:GeoPoint,nearArea?:string|null,onPartial?:(result:{hits:SearchHit[];status:string})=>void|Promise<void>){
 if(!query)return {hits:[] as SearchHit[],status:'skipped'};
 const catalogs=catalogHits||[];
 const budget=resolveSearch(query).maxPrice;
 if(catalogs.filter(h=>h.kind==='product'&&h.price!==null&&(budget===undefined||h.price<=budget)&&h.sourceAvailability!=='out_of_stock').length>=2)return {hits:deduplicate(catalogs),status:'seller-catalogs'};
 const provider=webProvider();if(!provider)return {hits:catalogs,status:catalogs.length?'seller-catalogs':'not-configured'};
 try{const external=(await provider.search(query,city,near,nearArea,async hits=>{await onPartial?.({hits:deduplicate([...catalogs,...hits]),status:provider.name});})).map(h=>h.kind==='product'&&!h.locationEvidence?{...h,city:h.point&&h.address?h.city:'',locationEvidence:h.point&&h.address?'confirmed-point' as const:'unverified' as const}:h);return {hits:deduplicate([...catalogs,...external]),status:provider.name};}catch(e){return {hits:catalogs,status:'unavailable',error:e instanceof Error?e.message:'Веб-поиск недоступен'};}
}
