import {jsonLD, indexedOfferHit, pageHit, extractOffers} from './offer-extraction';
import {relevantOffers} from './offer-relevance';
import {allowedSource, fetchSource} from './source-fetch';
import type {SearchHit} from './city-search';

type CatalogPage={url:string;html:string};
type Candidate={url:string};

function catalogLinks(page:CatalogPage,query:string,city:string):Candidate[]{
 const origin=new URL(page.url).origin;
 const candidates=new Map<string,Candidate>();
 function add(raw:unknown,name:unknown,structured:boolean){
  if(candidates.size>=24||typeof raw!=='string'||!raw.trim()||raw.startsWith('#'))return;
  let parsed:URL;
  try{parsed=new URL(raw.replace(/&amp;/gi,'&'),page.url);}catch{return;}
  parsed.hash='';
  const url=parsed.href;
  if(parsed.origin!==origin||url===page.url||!allowedSource(url)||candidates.has(url))return;
  const title=typeof name==='string'?name.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,240):'';
  if(!structured&&(!title||indexedOfferHit(url,title,undefined,city).kind!=='product'))return;
  if(title&&!relevantOffers([pageHit(url,title,city)],query,city).length)return;
  candidates.set(url,{url});
 }
 for(const node of jsonLD(page.html)){
  if(![node['@type']].flat().some(type=>type==='ItemList'||type==='https://schema.org/ItemList'))continue;
  for(const entry of [node.itemListElement].flat()){
   if(typeof entry==='string'){add(entry,'',true);continue;}
   if(!entry||typeof entry!=='object')continue;
   const item=entry as Record<string,unknown>;
   const target=item.item&&typeof item.item==='object'?item.item as Record<string,unknown>:item;
   add(target.url||target['@id']||item.url||item.item,target.name||item.name,true);
  }
 }
 for(const anchor of page.html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  add(anchor[2],anchor[3],false);
  if(candidates.size>=24)break;
 }
 return [...candidates.values()];
}

/** Follow one bounded level of first-party links, then verify the item on its own page. */
export async function searchCatalogPages(pages:CatalogPage[],query:string,city:string,read=fetchSource):Promise<SearchHit[]>{
 const visited=new Set(pages.map(page=>page.url));
 const perOrigin=new Map<string,number>();
 const candidates:Candidate[]=[];
 for(const page of pages){
  for(const candidate of catalogLinks(page,query,city)){
   const origin=new URL(candidate.url).origin;
   const count=perOrigin.get(origin)||0;
   if(visited.has(candidate.url)||count>=2)continue;
   visited.add(candidate.url);
   perOrigin.set(origin,count+1);
   candidates.push(candidate);
   if(candidates.length>=4)break;
  }
  if(candidates.length>=4)break;
 }
 const results=await Promise.all(candidates.map(async ({url})=>{
  const html=await read(url).catch(()=>null);
  if(!html)return [];
  // A recommendation on the detail page is not evidence for the clicked link.
  const items=extractOffers(html,url,city).filter(hit=>hit.kind==='product'&&(hit.site||hit.source)===url);
  return new Set(items.map(hit=>hit.title)).size===1?items:[];
 }));
 return relevantOffers(results.flat(),query,city);
}
