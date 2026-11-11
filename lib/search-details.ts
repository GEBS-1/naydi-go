import type {PublicSearchHit} from './city-search';
import type {SearchResponse} from './search-engine';
import {hash} from './onboarding';
import {cacheRead,cacheWrite} from './search-storage';

export type SearchDetails={imageSource?:string;title:string;description:string;phone:string|null;site:string|null;hours:string|null;source:string};
export async function searchDetails(key:string){return cacheRead<SearchDetails>('search-details:v1:'+key);}

export type PublicSearchResponse=Omit<SearchResponse,'hits'|'agent'|'intent'>&{
 hits:PublicSearchHit[];
 intent:Omit<SearchResponse['intent'],'category'|'selectors'>;
};

/** Project product data after the server has matched and ranked the results. */
export async function publicSearchView(response:SearchResponse):Promise<PublicSearchResponse>{
 const hits=await Promise.all(response.hits.map(async hit=>{
  const detailsKey=await hash(hit.id+'|'+hit.source);
  await cacheWrite('search-details:v1:'+detailsKey,{imageSource:hit.image?.startsWith('https://')?hit.image:undefined,title:hit.title,description:(hit.product?.description||hit.description).slice(0,4000),phone:hit.phone,site:hit.site,hours:hit.hours,source:hit.source} satisfies SearchDetails,24*3600000);
  const {category:_category,sellerLinks:_sellerLinks,product,...card}=hit;
  return {...card,brand:hit.brand||product?.brand,model:hit.model||product?.model,
   characteristics:hit.characteristics?.length?hit.characteristics:product?.attributes,
   image:hit.image?.startsWith('https://')?'/api/search/image?key='+detailsKey:hit.image,detailsKey,description:'',phone:null,hours:null,
   shop:hit.shop?{...hit.shop,category:'',phone:'',email:'',contact:'',hours:'',description:''}:undefined,
   product:product?{id:product.id,condition:product.condition,priceMode:product.priceMode}:undefined,
   sellerLocations:hit.sellerLocations?.map(({phone:_phone,hours:_hours,...point})=>point),
  } satisfies PublicSearchHit;
 }));
 const {agent:_agent,intent,...publicFields}=response;
 const {category:_category,selectors:_selectors,...publicIntent}=intent;
 return {...publicFields,intent:publicIntent,hits,results:response.results.map(result=>({...result,description:'',contacts:{phone:null,website:null}}))};
}
