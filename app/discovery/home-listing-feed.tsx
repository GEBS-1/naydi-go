'use client';

import {useEffect,useMemo,useState} from 'react';
import {MapPin,Navigation,Package} from 'lucide-react';
import {km} from '@/lib/discovery';
import {money} from '@/lib/model';
import {routeTo} from '../store-contacts';
import './home-listing-feed.css';

type Point={lat:number;lng:number};
type Store={id:string;name:string;city:string;street:string;lat:number;lng:number};
type Product={id:string;shopId:string;title:string;price:number|null;image:string|null};
type Feed={stores:Store[];products:Product[]};

export default function HomeListingFeed({city,near}:{city:string;near:Point|null}){
 const [state,setState]=useState<{city:string;feed?:Feed;error?:boolean}>();
 useEffect(()=>{if(!city)return;const controller=new AbortController();void fetch('/api/listings/map?'+new URLSearchParams({city}),{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Не удалось загрузить объявления');const feed=await response.json() as Feed;if(!controller.signal.aborted)setState({city,feed});}).catch(()=>{if(!controller.signal.aborted)setState({city,error:true});});return()=>controller.abort();},[city]);
 const current=state?.city===city?state:undefined;
 const offers=useMemo(()=>{const stores=new Map((current?.feed?.stores||[]).map(store=>[store.id,store]));const rows=(current?.feed?.products||[]).flatMap(product=>{const store=stores.get(product.shopId);return store?[{product,store,distance:near?km(store,near):null}]:[];});return near?rows.sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)).slice(0,8):rows.slice(0,8);},[current,near]);
 return <section className="home-listing-feed" aria-labelledby="home-listings-title"><header><div><h2 id="home-listings-title">Предложения {near?'рядом с вами':'в городе'}</h2><p>Опубликованы продавцами НайдиGo · {city}</p></div><a href="#browse"><MapPin size={17}/>Показать на карте</a></header>
  {!city?<p className="home-listing-empty">Выберите город, чтобы увидеть предложения.</p>:!current?<p className="home-listing-empty" role="status">Загружаем предложения…</p>:current.error?<p className="home-listing-empty" role="alert">Не удалось загрузить предложения.</p>:!offers.length?<p className="home-listing-empty">Пока нет опубликованных объявлений с подтверждённой точкой в этом городе. Найдите товар через строку поиска.</p>:<div className="home-listing-grid">{offers.map(({product,store,distance})=><article key={product.id} className="home-listing-card"><a className="home-listing-photo" href={'#product/'+encodeURIComponent(product.id)}>{product.image?<img src={product.image} alt={product.title} loading="lazy" onError={event=>{event.currentTarget.src='/favicon.svg';}}/>:<Package size={40} aria-label="Фото не опубликовано"/>}</a><div className="home-listing-info"><a className="home-listing-title" href={'#product/'+encodeURIComponent(product.id)}>{product.title}</a><strong>{money(product.price)}</strong><span className="home-listing-badge">Объявление продавца</span><p><MapPin size={14}/>{store.name} · {distance===null?store.street:`${distance.toFixed(1)} км`}</p><a className="home-listing-route" href={routeTo(store,near||undefined)} target="_blank" rel="noopener noreferrer"><Navigation size={15}/>Маршрут</a></div></article>)}</div>}
 </section>;
}
