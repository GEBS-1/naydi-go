'use client';

import {useEffect,useState} from 'react';
import {MapPin,Navigation,Package} from 'lucide-react';
import {km} from '@/lib/discovery';
import {money,type Shop} from '@/lib/model';
import {routeTo} from '../store-contacts';
import OffersMap from './offers';

type Point={lat:number;lng:number};
type Store=Pick<Shop,'id'|'name'|'city'|'street'|'lat'|'lng'|'addressConfirmed'|'category'>;
type Listing={id:string;shopId:string;title:string;price:number|null;image:string|null};
type Feed={stores:Store[];products:Listing[];limited:boolean};

function useListingMap(city:string){
 const [retry,setRetry]=useState(0);
 const [response,setResponse]=useState<{city:string;feed?:Feed;error?:boolean}>();
 useEffect(()=>{
  if(!city)return;
  const controller=new AbortController();
  void fetch('/api/listings/map?'+new URLSearchParams({city}),{signal:controller.signal})
   .then(async res=>{
    if(!res.ok)throw Error('Map unavailable');
    const feed=await res.json() as Feed;
    if(!controller.signal.aborted)setResponse({city,feed});
   }).catch(()=>{if(!controller.signal.aborted)setResponse({city,error:true});});
  return()=>controller.abort();
 },[city,retry]);

 return {current:response?.city===city?response:undefined,retry:()=>{setResponse(undefined);setRetry(n=>n+1);}};
}

export function ListingMapPreview({city,near,onOpen}:{city:string;near?:Point;onOpen:()=>void}){
 const {current}=useListingMap(city);
 const feed=current?.feed;
 const stores=feed?.stores||[];
 const ordered=near?[...stores].sort((a,b)=>km(a,near)-km(b,near)):stores;
 const seen=new Set<string>();
 const points=ordered.filter(store=>{
  const key=store.lat.toFixed(5)+','+store.lng.toFixed(5);
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 }).slice(0,5);
 const first=feed?.products.find(product=>product.shopId===points[0]?.id);
 return <aside className="home-map-preview" aria-labelledby="home-map-title">
  <h2 id="home-map-title">{near?'Что выставили рядом?':'Карта объявлений'}</h2>
  <p>{city?'Товары от людей и магазинов НайдиGO.':'Выберите город, чтобы увидеть объявления.'}</p>
  {points.length>0?<OffersMap key={city} stores={points} offers={[]} near={near} browse preview/>:
   <div className="home-map-placeholder"><MapPin size={28} aria-hidden="true"/><span>{!city?'Объявления по вашему городу':current?.error?'Не удалось загрузить точки':feed?'Пока в городе нет объявлений':'Загружаем точки…'}</span></div>}
  {first&&<p className="home-map-listing"><strong>{first.title}</strong>{first.price!==null&&<span>{money(first.price)}</span>}</p>}
  <a className="finder-primary home-map-open" href="#browse" onClick={onOpen}><MapPin size={17} aria-hidden="true"/>Открыть карту</a>
 </aside>;
}

export default function ListingMap({city,near,onChooseCity,onRequestLocation}:{city:string;near?:Point;onChooseCity:()=>void;onRequestLocation:()=>void}){
 const [selection,setSelection]=useState<{city:string;id:string}>();
 const {current,retry}=useListingMap(city);
 const feed=current?.feed;
 const stores=feed?.stores||[];
 const ordered=near?[...stores].sort((a,b)=>km(a,near)-km(b,near)):stores;
 const locations=new Map<string,Store>(),storeIds=new Map<string,string>();
 for(const store of ordered){
  const key=`${store.lat.toFixed(5)},${store.lng.toFixed(5)}`;
  const existing=locations.get(key);
  if(existing){
   locations.set(key,{...existing,name:'Предложения по адресу'});
   storeIds.set(store.id,existing.id);
  }else{
   locations.set(key,store);
   storeIds.set(store.id,store.id);
  }
 }
 const points=[...locations.values()];
 const selected=selection?.city===city?points.find(point=>point.id===selection.id):undefined;
 const productsByStore=new Map<string,Listing[]>();
 for(const product of feed?.products||[]){
  const items=productsByStore.get(product.shopId)||[];
  items.push(product);
  productsByStore.set(product.shopId,items);
 }
 const products=ordered.flatMap(store=>{
  if(selected&&storeIds.get(store.id)!==selected.id)return [];
  return (productsByStore.get(store.id)||[]).map(product=>({product,store}));
 });
 return <section aria-labelledby="listing-map-title">
  <h1 id="listing-map-title">Товары на карте</h1>
  <p>Объявления от людей и магазинов НайдиGO. Выберите точку, чтобы увидеть товары по этому адресу.</p>
  {!city?<button className="finder-primary" type="button" onClick={onChooseCity}>Выбрать город</button>:
   current?.error?<p role="alert">Не удалось загрузить объявления. <button type="button" onClick={retry}>Повторить</button></p>:
   !feed?<p role="status">Загружаем объявления…</p>:<>
    <div className="listing-map-layout">
     <OffersMap key={city} stores={points} offers={[]} near={near} browse selectedId={selected?.id} onSelect={id=>setSelection({city,id})} onRequestLocation={onRequestLocation}/>
     <aside className="listing-map-results" aria-label="Объявления рядом">
      <div className="listing-map-results-head">
       <h2>{selected?selected.street:'Объявления рядом'}</h2>
       {selected&&<button type="button" onClick={()=>setSelection(undefined)}>Все объявления</button>}
      </div>
      <p>Объявления: {products.length}{feed.limited?' · показаны последние 400':''}</p>
      {!products.length&&<p>Пока здесь нет объявлений.</p>}
      {products.map(({product,store})=><article className="listing-map-product" key={product.id}>
       <a className="listing-map-product-photo" href={'#product/'+encodeURIComponent(product.id)} aria-label={'Открыть '+product.title}>
        {product.image?<img src={product.image} alt="" loading="lazy" onError={e=>{if(!e.currentTarget.src.endsWith('/favicon.svg'))e.currentTarget.src='/favicon.svg';}}/>:<Package size={32} aria-hidden="true"/>}
       </a>
       <div className="listing-map-product-info">
        <a className="listing-map-product-title" href={'#product/'+encodeURIComponent(product.id)}>{product.title}</a>
        <strong>{money(product.price)}</strong>
        <span>{store.name}</span>
        <span><MapPin size={14} aria-hidden="true"/>{store.street}</span>
        <a className="listing-map-route" href={routeTo(store,near)} target="_blank" rel="noreferrer"><Navigation size={14} aria-hidden="true"/>Маршрут</a>
       </div>
      </article>)}
     </aside>
    </div>
   </>}
 </section>;
}
