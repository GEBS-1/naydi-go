'use client';
import {trackProductEvent} from '@/lib/product-events';
import {explicitCityCandidate} from '@/lib/location-context';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,Search,MapPin,Navigation,Camera,ShieldCheck,Zap,Layers3,Sparkles} from 'lucide-react';
import {type Product,type Shop} from '@/lib/model';
import {parseIntent,mapHitShop,safeHTTP,hasConfirmedLocation,routeHit} from '@/lib/city-search';
import type {PublicSearchResponse as SearchResponse} from '@/lib/search-details';
import {resolveSearch,type SearchContext} from '@/lib/search-context';
import {cleanCity,cityKey} from '@/lib/location';
import {rememberSearch,takeReplay} from '@/lib/personal';


import VoiceSearch from './voice-search';
import PhotoSearch from './photo-search';
import ResultCard from './result-card';
import OffersMap from './offers';
import ListingMap from './listing-map';
import HomeListingFeed from './home-listing-feed';
import JourneySearch,{Address} from '../journey-search';
import './style.css';
import './city.css';
import './nearby.css';
import './reference-home.css';
import './reference-map.css';
function pointWord(count:number){const last=count%10,tail=count%100;return tail>=11&&tail<=14?'точек':last===1?'точка':last>=2&&last<=4?'точки':'точек';}
function resultCacheKey(city:string,query:string,near?:{lat:number;lng:number}){return `ng_search_result:v10:${cityKey(city)}:${near?near.lat.toFixed(3)+','+near.lng.toFixed(3):'city'}:${query.trim().toLocaleLowerCase('ru-RU')}`;}
function cachedResult(city:string,query:string,near?:{lat:number;lng:number}){try{const saved=JSON.parse(localStorage.getItem(resultCacheKey(city,query,near))||'null') as {at:number;data:SearchResponse}|null;return saved&&Date.now()-saved.at<24*3600000?saved.data:null;}catch{return null;}}
function rememberResult(city:string,query:string,data:SearchResponse,near?:{lat:number;lng:number}){try{localStorage.setItem(resultCacheKey(city,query,near),JSON.stringify({at:Date.now(),data}));}catch{/* private browsing or storage full */}}
export default function SearchClient({page,id,card}:{page:string;id:string;card:(p:Product,s:Shop)=>ReactNode}){
 const [query,setQuery]=useState(id),[city,setCity]=useState(''),[cityEdit,setCityEdit]=useState(false),[ready,setReady]=useState(false),[headerReady,setHeaderReady]=useState(false),[journey,setJourney]=useState(false),[near,setNear]=useState<{lat:number;lng:number}>(),[manual,setManual]=useState(false),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[data,setData]=useState<SearchResponse|null>(null),[filter,setFilter]=useState('all');
 const searchPage=page==='home'||page==='browse'?page:'results';
 const replaying=useRef(false);const [filtersOpen,setFiltersOpen]=useState(false);
 const [selectedHit,setSelectedHit]=useState('');
 const browseReturn=useRef('#home'),browseDraft=useRef(''),previousPage=useRef(page);
 const [shown,setShown]=useState(10);const manualCity=useRef(false);
 useEffect(()=>{setShown(10);setSelectedHit('');},[id,filter,city]);
 const context=useRef<SearchContext|undefined>(undefined),[geoExplain,setGeoExplain]=useState(false),[pendingGeoSearch,setPendingGeoSearch]=useState(''),geoPrompt=useRef<HTMLDivElement>(null);
 const controller=useRef<AbortController|null>(null),rev=useRef(0),geoRev=useRef(0);
 const restoredGeo=useRef(false);
 useEffect(()=>setHeaderReady(true),[]);
 useEffect(()=>{if(!geoExplain)return;requestAnimationFrame(()=>geoPrompt.current?.focus({preventScroll:true}));},[geoExplain]);
 useEffect(()=>{const replay=takeReplay();if(replay){replaying.current=true;context.current=replay.context;setFilter(replay.filter);}let alive=true;try{const saved=localStorage.getItem('ng_city');if(saved){manualCity.current=true;setCity(saved);}}catch{}void fetch('/api/discovery').then(r=>r.json()).then(raw=>{if(!alive||manualCity.current)return;const b=raw as {city:string|null};if(b.city){setCity(b.city);try{sessionStorage.setItem('ng_current_city',b.city);}catch{}}}).catch(()=>{}).finally(()=>{if(alive)setReady(true);});return()=>{alive=false;controller.current?.abort();geoRev.current++;};},[]);

 function changeCity(value:string,manual=true){const next=cleanCity(value);if(next.length<2)return;if(manual){manualCity.current=true;try{localStorage.setItem('ng_city',next);}catch{}}controller.current?.abort();rev.current++;geoRev.current++;setData(null);setBusy(false);context.current=undefined;try{sessionStorage.removeItem('ng_search_context');}catch{}setNear(undefined);try{sessionStorage.removeItem('ng_search_anchor');}catch{}setNote('');setManual(false);setCity(next);setError('');try{sessionStorage.setItem('ng_current_city',next);}catch{}setCityEdit(false);}
 async function geoCity(point:{lat:number;lng:number},version:number,after?:(resolvedCity?:string)=>void){
  let resolvedCity:string|undefined;
  try{
   const response=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(point),signal:AbortSignal.timeout(4500)});
   const data=await response.json() as {city?:string};
   if(version!==geoRev.current)return;
   if(!response.ok||!data.city)throw Error('City unavailable');
   resolvedCity=data.city;
   if(cityKey(city)!==cityKey(data.city)){
    manualCity.current=false;setCity(data.city);context.current=undefined;setData(null);
    try{localStorage.setItem('ng_city',data.city);sessionStorage.setItem('ng_current_city',data.city);}catch{}
   }
   setCityEdit(false);setNear(point);setNote('');
  }catch{
   if(version===geoRev.current)setNote(city?'Не удалось уточнить местоположение. Используем выбранный город.':'Не удалось определить город. Выберите его вручную.');
  }finally{if(version===geoRev.current)after?.(resolvedCity);}
 }

 async function run(q:string){const text=q.trim();if(!text){setBusy(false);setData(null);setError('');setNote('Введите, что ищете — товар, услугу или тип магазина.');return;}if(!city){setCityEdit(true);setError('Укажите город для поиска.');return;}controller.current?.abort();const c=new AbortController();controller.current=c;const version=++rev.current;const deadline=window.setTimeout(()=>{if(version===rev.current){setError('Поиск занял слишком много времени. Повторите запрос позже.');c.abort();}},60000);setBusy(true);const saved=cachedResult(city,text,near);if(saved)setData(saved);else setData(current=>current&&current.context.query.trim().toLocaleLowerCase('ru-RU')===text.toLocaleLowerCase('ru-RU')?current:null);setError('');setNote('');const resume=replaying.current;replaying.current=false;try{const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({query:text,city,near,context:context.current,resume}),signal:c.signal});if(!r.ok){const b=await r.json().catch(()=>({})) as {error?:string};throw Error(b.error||'Не удалось выполнить поиск. Попробуйте позже.');}if(!r.body)throw Error('Не удалось выполнить поиск.');const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';for(;;){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines.filter(Boolean)){const result=JSON.parse(line) as SearchResponse&{error?:string};if(version!==rev.current)return;if(result.error)setError(result.error);else {context.current=result.context;try{sessionStorage.setItem('ng_search_context',JSON.stringify({city,context:result.context,at:Date.now()}));}catch{}setData(result);rememberResult(city,text,result,near);if(result.phase==='complete'){try{rememberSearch({query:result.context.query||text,city,filter,context:result.context,searchKey:result.searchKey});}catch(e){setNote((e as Error).message);}}if(result.phase==='complete'&&result.intent.journey){setQuery(result.context.query);setJourney(true);}}}if(done)break;}}catch(e){if(!c.signal.aborted)setError((e as Error).message);}finally{window.clearTimeout(deadline);if(version===rev.current)setBusy(false);}}
 useEffect(()=>{if(!city)return;try{const saved=JSON.parse(sessionStorage.getItem('ng_search_context')||'null');if(saved&&cityKey(saved.city||'')===cityKey(city)&&Date.now()-saved.at<30*60*1000&&typeof saved.context?.query==='string')context.current=saved.context;}catch{}},[city]);
 useEffect(()=>{if(page!=='home'){previousPage.current=page;return;}controller.current?.abort();rev.current++;setBusy(false);setData(null);if(previousPage.current!=='home'){setQuery(browseDraft.current);browseDraft.current='';}previousPage.current='home';setFilter('all');setJourney(false);setNote('');context.current=undefined;try{sessionStorage.removeItem('ng_search_context');}catch{}},[page]);
 useEffect(()=>{document.querySelector<HTMLElement>('.d-main')?.scrollTo({top:0,behavior:'auto'});},[page,id]);
 const [locationRestored,setLocationRestored]=useState(false);
 // Late city detection must not erase text already entered on the home screen.
 useEffect(()=>{if(!ready||!locationRestored||!city||searchPage!=='results')return;setQuery(id);if(!id.trim()){controller.current?.abort();rev.current++;setBusy(false);setData(null);setJourney(false);setError('');setNote('Введите товар или услугу.');return;}const resolved=resolveSearch(id,context.current);if(parseIntent(resolved.query,city).journey){setQuery(resolved.query);setJourney(true);}else{
  setJourney(false);
  const saved=cachedResult(city,id,near);
  if(saved?.phase==='complete'){
   context.current=saved.context;
   setData(saved);
   setBusy(false);
   setError('');
   setNote('');
  }else void run(id);
 }return()=>controller.current?.abort();},[searchPage,id,city,near,ready,locationRestored]);
 function begin(q:string){const text=q.trim();if(!text)return;try{sessionStorage.setItem('ng_last_search_query',text);}catch{}const resolved=resolveSearch(text,context.current);setQuery(text);setFilter('all');setJourney(false);if(parseIntent(resolved.query,city).journey){setJourney(true);setQuery(resolved.query);}const target=(page==='map'?'map/':'search/')+encodeURIComponent(text);if(location.hash.slice(1)===target)void run(text);else location.hash=target;}
 function continuePendingSearch(resolvedCity?:string){
  setGeoExplain(false);
  if(!city&&!resolvedCity){setCityEdit(true);return;}
  if(!pendingGeoSearch)return;
  setPendingGeoSearch('');
  location.hash=(page==='map'?'map/':'search/')+encodeURIComponent(pendingGeoSearch);
 }
 async function submit(q:string){
  const text=q.trim();if(!text)return;
  if(!parseIntent(text,city).journey&&explicitCityCandidate(text)){
   try{
    const response=await fetch('/api/location/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:text}),signal:AbortSignal.timeout(4500)});
    const data=await response.json() as {location?:{city:string;query:string}};
    if(data.location){changeCity(data.location.city);setQuery(data.location.query);location.hash=(page==='map'?'map/':'search/')+encodeURIComponent(data.location.query);return;}
   }catch{}
   setNote('Не удалось подтвердить город из запроса. Выберите город вручную.');setCityEdit(true);return;
  }
  if(!city){setPendingGeoSearch(text);setGeoExplain(true);return;}
  begin(text);
 }
 function locate(after?:(resolvedCity?:string)=>void){
  setGeoExplain(false);
  const version=++geoRev.current;
  let finished=false;
  const timer=window.setTimeout(fail,6000);
  function fail(){
   if(finished)return;
   finished=true;window.clearTimeout(timer);
   if(version!==geoRev.current)return;
   setNote(city?'Местоположение не получено. Используем выбранный город.':'Местоположение не получено. Выберите город вручную.');
   after?.();
  }
  setNote('Запрашиваем местоположение…');
  if(!navigator.geolocation){fail();return;}
  navigator.geolocation.getCurrentPosition(position=>{
   if(finished)return;
   finished=true;window.clearTimeout(timer);
   if(version===geoRev.current)void geoCity({lat:position.coords.latitude,lng:position.coords.longitude},version,after);
  },fail,{timeout:5500,maximumAge:60000});
 }
 useEffect(()=>{if(!ready||restoredGeo.current)return;restoredGeo.current=true;setLocationRestored(true);try{const saved=JSON.parse(sessionStorage.getItem('ng_search_anchor')||'null');if(saved&&Date.now()-saved.at<30*60*1000&&(!city||cityKey(saved.city)===cityKey(city))&&Number.isFinite(saved.point?.lat)&&Number.isFinite(saved.point?.lng)){setNear(saved.point);if(!city)setCity(saved.city);return;}}catch{}if(navigator.permissions)void navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state==='granted')locate();}).catch(()=>{});},[ready,city]);
 useEffect(()=>{if(near&&city)try{sessionStorage.setItem('ng_search_anchor',JSON.stringify({point:near,city,at:Date.now()}));}catch{}},[near,city]);
 const allHits=data?.hits||[];
 const matchesFilter=(hit:(typeof allHits)[number],value:string)=>value==='all'||(value==='seller'?hit.status==='seller-confirmed':value==='web'?hit.status==='website':hit.kind===value);
 const hits=allHits.filter(hit=>matchesFilter(hit,filter));
 const productQuery=data?.intent.kind==='product'&&(filter==='all'||filter==='product');
 const productSearch=productQuery&&filter==='all';
 const mappedHits=hits.filter(hasConfirmedLocation);
 const mappedProducts=mappedHits.filter(h=>h.kind==='product');
 const addressHits=productSearch
  ?[...mappedProducts,...mappedHits.filter(h=>h.kind!=='product'&&!(h.kind==='store'&&mappedProducts.some(product=>product.site&&product.site===h.site&&product.address===h.address)))]
  :mappedHits;
 const internetHits=hits.filter(h=>!hasConfirmedLocation(h));
 const sourceLinks=internetHits.filter(h=>h.kind==='page');
 const onlineOffers=internetHits.filter(h=>!sourceLinks.includes(h));
 const visibleHits=addressHits.slice(0,shown);
 const orderedHits=page==='map'&&selectedHit
  ? [...visibleHits.filter(h=>h.id===selectedHit),...visibleHits.filter(h=>h.id!==selectedHit)]
  : visibleHits;
 const showStoreFallback=productSearch;
 const mainHits=showStoreFallback?orderedHits.filter(h=>h.kind!=='store'):orderedHits;
 const fallbackStores=showStoreFallback?orderedHits.filter(h=>h.kind==='store').slice(0,Math.max(5,shown-5)):[];
 const mappableHits=[...mainHits,...fallbackStores];
 const unlocatedProducts=productQuery?onlineOffers.filter(h=>h.kind==='product'):[];
 const otherOnlineOffers=onlineOffers.filter(h=>!unlocatedProducts.includes(h));
 const storeMap=new Map(mappableHits.map(h=>{const shop=mapHitShop(h,addressHits);return [shop.id,shop] as const;})),stores=[...storeMap.values()];
 const linkedProducts=mappableHits.filter(h=>h.kind==='product'||h.kind==='service').map(h=>({shopId:mapHitShop(h,addressHits).id,title:h.title,price:h.price,id:h.id,image:h.image,route:routeHit(h,near),url:h.product?'#product/'+encodeURIComponent(h.product.id):safeHTTP(h.source)||undefined,kind:h.kind==='service'?'service' as const:'product' as const,sellerConfirmed:h.status==='seller-confirmed'}));
 const mappedSelection=mappableHits.find(h=>h.id===selectedHit);
 const selectedShopId=mappedSelection?mapHitShop(mappedSelection,addressHits).id:undefined;
 function selectHit(id:string,scroll=false){const index=addressHits.findIndex(h=>h.id===id);if(index<0)return;setSelectedHit(id);setShown(n=>Math.max(n,index+1));if(scroll)window.setTimeout(()=>document.getElementById('search-hit-'+id)?.scrollIntoView({behavior:'smooth',block:'nearest'}),80);}
 function selectShop(id:string){const linked=mappableHits.filter(h=>mapHitShop(h,addressHits).id===id);const target=linked.find(h=>h.kind==='product')||linked[0];if(target)selectHit(target.id,true);}
 const popularQueries=['Свечи Denso для RAV4','Замена масла','Ремонт телефона','Велосипед','Корм для собак','Шины 225/65 R17'];
 const searchBox=<VoiceSearch placeholder={page==='home'?'Что вы ищете? Например: свечи Denso для RAV4, ремонт телефона, шиномонтаж...':undefined} photoControl={page==="home"?<label className="home-inline-camera" htmlFor="home-search-image" title="Найти по фото"><Camera size={22} aria-hidden="true"/><span className="sr-only">Найти по фото</span></label>:undefined} value={query} onChange={setQuery} busy={false} onSearch={text=>submit(text??query)}/>;
 const cityButton=<button type="button" className="finder-header-city" aria-label={`Текущий город: ${city||'не выбран'}. Изменить город`} onClick={()=>setCityEdit(true)}><MapPin size={17}/><span>{city||'Выбрать город'}</span><ChevronDown size={15}/></button>;
 const citySlot=headerReady?document.getElementById('buyer-city-slot'):null;
 const locationControl=<div className="nearby-location"><button type="button" onClick={()=>setGeoExplain(true)}><MapPin size={17}/>{near?`Рядом с вами · ${city}`:'Указать, где искать'}</button>{!near&&city&&<span>Сейчас — весь город {city}</span>}{page==="map"&&<button type="button" className="map-journey-toggle" aria-pressed={journey} onClick={()=>setJourney(value=>!value)}><Navigation size={17}/>По дороге</button>}</div>;
 return <div className={'finder nearby-focus finder-page-'+page}>
 {citySlot&&createPortal(cityButton,citySlot)}
 {cityEdit&&<form className="finder-city-form" onSubmit={e=>{e.preventDefault();const value=cleanCity(new FormData(e.currentTarget).get('city'));if(value.length<2)return;changeCity(value);if(pendingGeoSearch){location.hash=(page==='map'?'map/':'search/')+encodeURIComponent(pendingGeoSearch);setPendingGeoSearch('');}}}><label>Город<input name="city" defaultValue={city} minLength={2} maxLength={100} required autoFocus/></label><button className="finder-primary">Сохранить</button><button type="button" onClick={()=>{setCityEdit(false);setGeoExplain(true);}}>Определить автоматически</button><button type="button" aria-label="Закрыть выбор города" onClick={()=>setCityEdit(false)}>Закрыть</button></form>}
 {page==='home'?<div className={'nearby-home home-layout reference-home'+(city.toLocaleLowerCase('ru-RU').startsWith('казан')?' city-kazan':'')}>
  <section className="home-search-intro" aria-labelledby="home-search-title">
   <h1 id="home-search-title">Найди товары и услуги <span>рядом с тобой</span></h1>
   <p className="nearby-lead">Умный поиск по магазинам, услугам и объявлениям. Ищем предложения для тебя через Perplexity и у реальных продавцов в твоём городе.</p>
   <div className="home-benefits" aria-label="Возможности НайдиGo"><span><Zap size={19}/>Быстрый поиск предложений</span><span><MapPin size={19}/>Магазины и услуги рядом</span><span><ShieldCheck size={19}/>Цена и наличие с отметкой источника</span><span><Layers3 size={19}/>Один сервис для всего</span></div>
   <div className="home-guide-search">{searchBox}</div>
   <div className="home-photo-search"><PhotoSearch inputId="home-search-image" onQuery={text=>{setQuery(text);void submit(text);}}/></div>
  </section>
  <section className="home-perplexity-card" aria-labelledby="home-perplexity-title">
   <div className="home-perplexity-copy"><Sparkles size={18} aria-hidden="true"/><div><strong id="home-perplexity-title">Помощник НайдиGo</strong><p>Опишите задачу своими словами. Поиск соберёт подходящие предложения и покажет точки на карте.</p></div></div>
   <button type="button" className="home-assistant-open" onClick={()=>window.dispatchEvent(new Event('ng-open-site-helper'))}>Открыть помощника</button>
  </section>
  <HomeListingFeed city={city} near={near||null}/>
  <section className="home-popular" aria-labelledby="home-popular-title"><h2 id="home-popular-title">Примеры запросов{city?` для города ${city}`:''}</h2><div>{popularQueries.map(item=><button type="button" key={item} onClick={()=>void submit(item)}><Search size={15} aria-hidden="true"/>{item}</button>)}</div></section>
 </div>:page==='browse'?<><a className="listing-map-back" href={browseReturn.current}>← Назад к поиску</a>{locationControl}</>:<>{searchBox}{locationControl}</>}
 {geoExplain&&<div className="finder-location-overlay" onKeyDown={e=>{if(e.key==='Escape'){setGeoExplain(false);setPendingGeoSearch('');}}}><section ref={geoPrompt} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="finder-location-title" className="finder-location-dialog"><div className="finder-location-icon"><MapPin size={25}/></div><h2 id="finder-location-title">Откуда искать?</h2><p>Геолокация помогает показать расстояние и начать маршрут от вас. Если город уже выбран, можно искать по всему городу.</p><button className="finder-location-allow" onClick={()=>locate(continuePendingSearch)}><MapPin size={17}/>Разрешить браузеру</button>{city&&<button className="finder-location-address" onClick={()=>{setGeoExplain(false);setManual(true);}}>Указать адрес вручную</button>}<button className="finder-location-skip" onClick={()=>continuePendingSearch()}>{city?'Продолжить по городу':'Выбрать город'}</button><button type="button" className="nearby-dialog-close" onClick={()=>{setGeoExplain(false);setPendingGeoSearch('');}}>Закрыть</button></section></div>}
 {manual&&<Address city={city} label="Откуда искать — адрес" value={null} onChange={p=>{if(p){setNear(p);setManual(false);setNote('');if(pendingGeoSearch)continuePendingSearch();}}}/>}
 {note&&/(?:не получено|недоступн|не удалось|Запрашиваем|сохранён)/iu.test(note)&&<p className="nearby-status" role="status">{note}</p>}
 {error&&<p role="alert" className="finder-error">{error}</p>}
 {page==='browse'&&<ListingMap city={city} near={near} onChooseCity={()=>setCityEdit(true)} onRequestLocation={()=>setGeoExplain(true)}/>}
 {searchPage==='results'&&<>
 <div className="nearby-toolbar"><div className="nearby-result-count">{busy?'Ищем рядом…':stores.length?`${stores.length} ${pointWord(stores.length)} на карте`:'Подтверждённых точек пока нет'}</div><div className="nearby-view"><button type="button" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(v=>!v)}>Фильтры</button><a aria-current={page!=='map'?'page':undefined} href={'#search/'+encodeURIComponent(id)}>Список</a><a aria-current={page==='map'?'page':undefined} href={'#map/'+encodeURIComponent(id)}>Карта</a></div></div>
 {page==='map'&&!journey&&<div className="map-source-filters" role="group" aria-label="Фильтры предложений на карте">
  {([['all','Все'],['seller','От продавцов'],['web','Из интернета'],['service','Услуги']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label} <span>{allHits.filter(hit=>matchesFilter(hit,value)).length}</span></button>)}
 </div>}
 {filtersOpen&&<div className="finder-tabs nearby-filters">{[['all','Все'],['product','Товары'],['store','Магазины'],['service','Услуги'],['page','Сайты']].map(([value,label])=><button aria-pressed={filter===value} key={value} onClick={()=>setFilter(value)}>{label}</button>)}{data&&<button onClick={()=>void(async()=>{rememberSearch({query:data.context.query,city,filter,context:data.context},true);trackProductEvent('saved_search',city);setNote('Поиск сохранён.');})()}>Сохранить поиск</button>}</div>}
 {journey?<JourneySearch key={city} query={query} city={city} near={near} card={card} onNearby={()=>{setJourney(false);void run(query);}}/>:<>
 {!!data?.intent.clarification.length&&<p className="nearby-status">Уточните: {data.intent.clarification.map(q=><button key={q} onClick={()=>submit(q)}>{q}</button>)}</p>}
 <div className={'finder-results-grid nearby-results '+(page==='map'?'map-view':'')}>
 <div className="nearby-list">
 {mainHits.map(h=><ResultCard key={h.id} hit={h} near={near} selected={selectedHit===h.id} onSelect={()=>selectHit(h.id)}/>)}
 {fallbackStores.length>0&&<div className="nearby-store-fallback">
  <h2>Где можно спросить</h2><p>Конкретный товар в этих магазинах пока не подтверждён.</p>
  {fallbackStores.map(h=><ResultCard key={h.id} hit={h} near={near} selected={selectedHit===h.id} onSelect={()=>selectHit(h.id)}/>)}
 </div>}
 {unlocatedProducts.length>0&&<div className="nearby-unlocated">
  <h2>Товары без подтверждённого адреса</h2>
  {unlocatedProducts.slice(0,shown).map(h=><ResultCard key={h.id} hit={h} near={near}/>)}
 </div>}
 {(addressHits.length>shown||unlocatedProducts.length>shown)&&<button className="nearby-more" onClick={()=>setShown(n=>n+10)}>Ещё результаты</button>}
 {!busy&&!!data&&!mappableHits.length&&<div className="nearby-empty"><Search size={25}/>
  <h2>{productQuery?(unlocatedProducts.length?'Адрес покупки пока не подтверждён':'Конкретный товар пока не найден'):internetHits.length?'Пока не нашли адрес рядом':'Пока ничего не нашли'}</h2>
  <p>{productQuery?(unlocatedProducts.length?'Откройте предложение, чтобы уточнить адрес у продавца.':'Можно уточнить название или модель. Магазины для уточнения и найденные ссылки показаны отдельно.'):'Попробуйте другое название или укажите, где искать.'}</p>
 </div>}
 {otherOnlineOffers.length>0&&<details className="nearby-internet"><summary>Предложения без подтверждённого адреса · {otherOnlineOffers.length}</summary>{otherOnlineOffers.slice(0,shown).map(h=><ResultCard key={h.id} hit={h} near={near}/>)}</details>}
 {sourceLinks.length>0&&<details className="nearby-internet" open={filter==='page'||undefined}>
  <summary>Ссылки для самостоятельного поиска · {sourceLinks.length}</summary>
  <p>На этих страницах не удалось выделить конкретное предложение.</p>
  <ul className="nearby-source-links">{sourceLinks.slice(0,shown).map(h=>{const url=safeHTTP(h.site)||safeHTTP(h.source);return url?<li key={h.id}><a href={url} target="_blank" rel="noreferrer">{h.title}</a></li>:null;})}</ul>
 </details>}
 </div><aside><OffersMap compact productSearch={productQuery} stores={stores} offers={[]} linkedProducts={linkedProducts} selectedId={selectedShopId} selectedHitId={selectedHit} onSelect={selectShop} onSelectHit={id=>selectHit(id,true)} near={near} onRequestLocation={()=>setGeoExplain(true)}/></aside></div>
 </>}
 </>}
 </div>;
}
