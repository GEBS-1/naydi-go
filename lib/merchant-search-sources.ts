import {hasConfirmedLocation, type GeoPoint, type SearchHit} from './city-search';
import {km} from './discovery';
import {cityKey} from './location';
import {allowedSource} from './source-fetch';

function identity(raw:string){
 const url=allowedSource(raw);
 if(!url)return null;
 const host=url.hostname.replace(/^www\./,'').replace(/^m\.(?=vk\.)/,'');
 const path=url.pathname.toLowerCase();
 if(host==='t.me'||host==='telegram.me'){
  const channel=path.match(/^\/(?:s\/)?([a-z][a-z0-9_]{4,})(?:\/\d+)?\/?$/)?.[1];
  return channel?{key:'telegram:'+channel,url:'https://t.me/'+channel}:null;
 }
 if(host==='vk.com'||host==='vk.ru'){
  const group=path.match(/^\/(?:club|public)(\d+)\/?$/)?.[1]
   ||path.match(/^\/wall-(\d+)_\d+\/?$/)?.[1];
  return group?{key:'vk:'+group,url:'https://vk.com/club'+group}:null;
 }
 if(/(?:^|\.)(?:avito\.ru|2gis\.ru|yandex\.ru|ya\.ru|ozon\.ru|wildberries\.ru)$/.test(host))return null;
 return {key:'site:'+host,url:url.origin};
}

export function matchesMerchantSource(source:string,candidate:string){
 const wanted=identity(source),actual=identity(candidate);
 return !!wanted&&wanted.key===actual?.key;
}

export function merchantSearchSources(places:SearchHit[],city:string,near?:GeoPoint){
 const stores=places.filter(place=>place.kind==='store'&&hasConfirmedLocation(place)&&cityKey(place.city)===cityKey(city));
 if(near)stores.sort((a,b)=>km(near,a.point!)-km(near,b.point!));
 const sources=new Map<string,string>();
 for(const place of stores){
  for(const raw of [place.site,place.shop?.site,place.shop?.vk,place.shop?.telegram,...(place.sellerLinks||[])]){
   const source=raw?identity(raw):null;
   if(source)sources.set(source.key,source.url);
   if(sources.size===4)return [...sources.values()];
  }
 }
 return [...sources.values()];
}
