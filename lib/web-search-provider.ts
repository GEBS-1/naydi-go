import {routerWebProvider} from './router-web-provider';
import type {SearchHit} from './city-search';
export interface WebSearchProvider {name:string;search(query:string,city:string):Promise<SearchHit[]>;}
export function webProvider():WebSearchProvider|null{return routerWebProvider();}
export async function searchWeb(query:string,city:string){const provider=webProvider();if(!provider||!query)return {hits:[] as SearchHit[],status:provider?'skipped':'not-configured'};try{return {hits:await provider.search(query,city),status:provider.name};}catch(e){return {hits:[] as SearchHit[],status:'unavailable',error:e instanceof Error?e.message:'Веб-поиск недоступен'};}}
