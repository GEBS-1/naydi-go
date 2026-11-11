import {hash} from './onboarding';
import {cacheWrite} from './search-storage';
import {cityKey} from './location';
import {searchIdentity,searchZone} from './nearby-topics';
import type {SearchResponse} from './search-engine';
import type {GeoPoint} from './city-search';

export async function rememberSearchIndex(result:SearchResponse,city:string,near:GeoPoint|undefined){
 city=result.searchArea?.city||city;const zone=result.searchArea?.zone||searchZone(near);
 const key=await hash(searchIdentity(result.context.query,city,near,zone));
 await cacheWrite('search-index:v1:'+key,{key,city:cityKey(city),zone,resultCount:result.hits.length,at:Date.now()},7*86400000);
 return key;
}
