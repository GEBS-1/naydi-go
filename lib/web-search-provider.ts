import {routerWebProvider} from './router-web-provider';
import {catalogOffers} from './seller-catalogs';
import {deduplicate} from './city-search';
import {resolveSearch} from './search-context';
import type {SearchHit} from './city-search';
export interface WebSearchProvider {name:string;search(query:string,city:string):Promise<SearchHit[]>;}
export function webProvider():WebSearchProvider|null{return routerWebProvider();}
export async function searchWeb(query:string,city:string){
 if(!query)return {hits:[] as SearchHit[],status:'skipped'};
 const catalogs=await catalogOffers(query,city).catch(()=>[] as SearchHit[]);
 const budget=resolveSearch(query).maxPrice;
 if(catalogs.filter(h=>h.kind==='product'&&h.price!==null&&(budget===undefined||h.price<=budget)&&h.sourceAvailability!=='out_of_stock').length>=2)return {hits:deduplicate(catalogs),status:'seller-catalogs'};
 const provider=webProvider();if(!provider)return {hits:catalogs,status:catalogs.length?'seller-catalogs':'not-configured'};
 try{const external=(await provider.search(query,city)).map(h=>h.kind==='product'&&!h.locationEvidence?{...h,city:h.point&&h.address?h.city:'',locationEvidence:h.point&&h.address?'confirmed-point' as const:'unverified' as const}:h);return {hits:deduplicate([...catalogs,...external]),status:provider.name};}catch(e){return {hits:catalogs,status:'unavailable',error:e instanceof Error?e.message:'Веб-поиск недоступен'};}
}
