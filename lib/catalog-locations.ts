import type {SearchHit} from './city-search';

export type CatalogLocation={
 name:string;category:string;address:string;point:{lat:number;lng:number};phone?:string;
 source:string;pointSource:string;complete:boolean;checkedAt:string;
 branches?:{address:string;point:{lat:number;lng:number};phone?:string;hours?:string;source?:string}[];
};

// First-party seller address plus one unique exact-house Photon/OSM match.
// `complete` means all branches are mapped; false deliberately prevents assigning
// an online offer to an arbitrary branch of a multi-location seller.
const locations:Record<string,CatalogLocation>={
 'kazan.tatmetiz.ru':{name:'Татметиз',category:'Дом и ремонт',address:'ул. Фатыха Амирхана, 25, Казань',point:{lat:55.8281292,lng:49.1318797},phone:'+7 843 250-72-44',source:'https://kazan.tatmetiz.ru/',pointSource:'https://www.openstreetmap.org/way/281909411',complete:true,checkedAt:'2026-10-22T00:00:00.000Z'},
 'autocraft-kzn.ru':{name:'АвтоКрафт',category:'Автотовары',address:'ул. Аделя Кутуя, 72, Казань',point:{lat:55.7845845,lng:49.1820574},phone:'+7 927 039-06-31',source:'https://autocraft-kzn.ru/',pointSource:'https://www.openstreetmap.org/way/87328233',complete:true,checkedAt:'2026-10-22T00:00:00.000Z'},
 'gazzap116.ru':{name:'ГАЗЗАПЧАСТИ',category:'Автотовары',address:'Мамадышский тракт, 35, корп. 1, Казань',point:{lat:55.8017807,lng:49.2601037},source:'https://gazzap116.ru/',pointSource:'https://www.openstreetmap.org/way/306647134',complete:true,checkedAt:'2026-10-22T00:00:00.000Z'},
 'megakrepezh.ru':{name:'Мега Крепёж',category:'Дом и ремонт',address:'ул. Баруди, 18, Казань',point:{lat:55.8228322,lng:49.0684116},source:'https://megakrepezh.ru/',pointSource:'https://www.openstreetmap.org/relation/15994143',complete:false,checkedAt:'2026-10-22T00:00:00.000Z'},
 'velosky.ru':{name:'Velosky',category:'Спорт и хобби',address:'проспект Победы, 100, Казань',point:{lat:55.7688498,lng:49.2208479},phone:'+7 843 250-90-96',source:'https://velosky.ru/',pointSource:'https://www.openstreetmap.org/way/98682813',complete:true,checkedAt:'2026-10-22T00:00:00.000Z',branches:[
  {address:'проспект Победы, 100, Казань',point:{lat:55.7688498,lng:49.2208479},phone:'+7 843 250-90-96',source:'https://www.openstreetmap.org/way/98682813'},
  {address:'ул. Маршала Чуйкова, 93, Казань',point:{lat:55.8362836,lng:49.1573532},phone:'+7 843 250-90-96',source:'https://www.openstreetmap.org/way/62194573'},
 ]},
};

function host(value:string){try{return new URL(value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
export function catalogLocationForUrl(value:string):CatalogLocation|undefined{return locations[host(value)];}

function kmBetween(a:{lat:number;lng:number},b:{lat:number;lng:number}){
 const rad=(n:number)=>n*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

/** Attach confirmed seller locations to catalog offers without asserting branch inventory. */
export function attachCatalogLocations(hits:SearchHit[],near?:{lat:number;lng:number}):SearchHit[]{
 return hits.map(hit=>{
  if(hit.kind!=='product')return hit;
  const location=catalogLocationForUrl(hit.site||hit.source);if(!location)return hit;
  if(location.complete===false&&!location.branches?.length)return hit;
  const branches=location.branches?.length?location.branches:[{address:location.address,point:location.point,phone:location.phone,source:location.pointSource}];
  const branch=near?[...branches].sort((a,b)=>kmBetween(near,a.point)-kmBetween(near,b.point))[0]:branches[0];
  return {...hit,address:branch.address,point:branch.point,phone:branch.phone||location.phone||hit.phone,
   locationSource:branch.source||location.pointSource||location.source,locationEvidence:'confirmed-point',sellerLocationGroupComplete:location.complete,
   sellerLocations:branches,description:(hit.description?`${hit.description} `:'')+'Адрес ближайшей точки продавца подтверждён; наличие товара в этой точке уточните у продавца.'};
 });
}

/** Address pins are separate store results and never imply inventory at the branch. */
export function catalogLocationHits(query:string,city:string,sources:{matches:RegExp;url:string}[]):SearchHit[]{
 if(!/^казань$/iu.test(city.trim()))return [];
 const found=new Map<string,CatalogLocation>();
 for(const source of sources.filter(item=>item.matches.test(query)).slice(0,2)){
  const location=catalogLocationForUrl(source.url);if(location){const branches=location.branches?.length?location.branches:[{address:location.address,point:location.point,phone:location.phone,source:location.pointSource}];for(const branch of branches)found.set(location.name+'|'+branch.address,{...location,...branch,address:branch.address,point:branch.point,phone:branch.phone||location.phone,pointSource:branch.source||location.pointSource});}
 }
 return [...found.values()].map(location=>({
  id:`seller-location:${host(location.source)}:${location.address}`,kind:'store',title:location.name,
  description:'Адрес продавца подтверждён. Наличие конкретного товара в этой торговой точке не подтверждено.',
  category:location.category,city:'Казань',address:location.address,point:location.point,phone:location.phone||null,
  site:location.source,hours:null,source:location.source,checkedAt:location.checkedAt,price:null,image:null,
  status:'organization',distanceKm:null,locationSource:location.pointSource,locationEvidence:'confirmed-point',
  sellerLocationGroupComplete:location.complete,
 }));
}
