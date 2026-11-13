'use client';
import {useState} from 'react';
import {MapPin,Navigation,Phone,ExternalLink,MessageCircle,X} from 'lucide-react';
import {routeHit,safeHTTP,type PublicSearchHit} from '@/lib/city-search';
import {trackProductEvent} from '@/lib/product-events';
import {money} from '@/lib/model';
import type {SearchDetails} from '@/lib/search-details';
import {FavoriteButton} from '../personal';
import './reference-favorites.css';

export default function ResultCard({hit:h,near,selected=false,onSelect}:{hit:PublicSearchHit;near?:{lat:number;lng:number};selected?:boolean;onSelect?:()=>void}){
 const [details,setDetails]=useState<SearchDetails|null>(null),[expanded,setExpanded]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const route=routeHit(h,near);
 const sourceUrl=safeHTTP(h.source);
 const sourceHost=sourceUrl?new URL(sourceUrl).hostname.replace(/^(?:www|m)\./,''):'';
 const sourceLabel=h.kind==='product'?(h.status==='seller-confirmed'?'Объявление продавца':sourceHost?`Найдено в интернете · ${sourceHost}`:'Найдено в интернете'):null;
 const privateSeller=h.shop?.sellerType==='private';
 const seller=(h.seller||h.shop?.name||(h.kind==='store'?h.title:'')).trim();
 const image=h.image&&!/(?:no[-_]?image|no[-_]?photo|placeholder|default_part)/i.test(h.image)?h.image:null;
 async function openDetails(){
  if(expanded){setExpanded(false);return;}
  setError('');
  if(details){setExpanded(true);return;}
  setLoading(true);
  try{
   if(!h.detailsKey){setDetails({title:h.title,description:h.description,phone:h.phone,site:h.site,hours:h.hours,source:h.source});setExpanded(true);return;}
   const response=await fetch('/api/search/details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:h.detailsKey})});
   const body=await response.json() as SearchDetails&{error?:string};
   if(!response.ok)throw Error(body.error||'Не удалось открыть контакты.');
   setDetails(body);setExpanded(true);
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 }
 const phone=details?.phone?.split(';')[0].trim(),phoneHref=phone?'tel:'+phone.replace(/[^+\d]/g,''):'';
 const source=safeHTTP(details?.source),site=safeHTTP(details?.site);
 const website=h.kind==='product'?source||site:site||source;
 const favoriteUrl=h.status==='seller-confirmed'&&h.product?'#product/'+h.product.id:h.shop?.id&&h.status==='seller-confirmed'?'#store/'+h.shop.id:sourceUrl||safeHTTP(h.site)||'#search/'+encodeURIComponent(h.title);
 return <>{expanded&&<button type="button" className="nearby-detail-backdrop" aria-label="Закрыть карточку предложения" onClick={()=>setExpanded(false)}/>}<article id={'search-hit-'+h.id} tabIndex={-1} data-selected={selected||undefined} onClick={onSelect} onFocus={onSelect} className={'search-hit nearby-card'+(h.kind==='product'?' nearby-product':'')+(h.product&&h.shop&&h.status==='seller-confirmed'?' nearby-listing':'')+(expanded?' nearby-card-expanded':'')}>
  <ResultImage key={image||h.source} src={image} title={h.title}/>
  <div className="nearby-card-body">
   {expanded&&<button type="button" className="nearby-detail-close" aria-label="Закрыть карточку" onClick={()=>setExpanded(false)}><X size={20}/></button>}
   <div className="nearby-card-heading"><h2><button type="button" className="nearby-title" aria-expanded={expanded} onClick={()=>void openDetails()} disabled={loading}>{h.title}</button></h2>{h.price!==null?<strong>{h.product?.priceMode==='free'?'Бесплатно':money(h.price)}</strong>:h.product?.priceMode==='negotiable'?<strong>Договорная</strong>:h.kind==='product'?<span className="nearby-price-unknown">Цена не указана</span>:null}<FavoriteButton item={{id:h.kind+':'+h.id,title:h.title,kind:h.kind,url:favoriteUrl,city:h.city,image:image||undefined,price:h.price,checkedAt:h.checkedAt,address:route?h.address||undefined:undefined,destination:route?h.point||undefined:undefined}}/></div>
   {sourceLabel&&<small className="nearby-source-label">{sourceLabel}</small>}
   {(h.model||h.brand)&&<p className="nearby-model">{[h.brand,h.model].filter(Boolean).join(' · ')}</p>}
   {expanded&&!!h.characteristics?.length&&<p className="nearby-specs">{h.characteristics.map(x=>x.name+': '+x.value).join(' · ')}</p>}
   {expanded&&h.rating&&<p className="nearby-rating">★ {h.rating.value} / {h.rating.best}{h.rating.count?' · '+h.rating.count+' оценок':''} · по данным источника</p>}
   {seller&&seller!==h.title&&<p className="nearby-card-seller">{privateSeller?'Частный продавец · ':''}{seller}</p>}{h.product?.condition&&h.product.condition!=='unknown'&&<small>{h.product.condition==='used'?'Б/у':'Новый'}</small>}
   <p className="search-hit-address"><MapPin size={14}/><span>{h.address?(h.city&&!h.address.toLocaleLowerCase().includes(h.city.toLocaleLowerCase())?h.city+', '+h.address:h.address):'Адрес пока не найден'}</span>{h.distanceKm!==null&&<b title="Расстояние по прямой">{h.distanceKm<1?Math.round(h.distanceKm*1000)+' м':h.distanceKm.toFixed(1)+' км'}</b>}</p>
   <small className="nearby-availability">{h.sourceAvailability==='out_of_stock'?'Нет в наличии':h.status==='seller-confirmed'&&h.sourceAvailability==='in_stock'?(privateSeller?'Продаётся':'Есть в магазине'):h.kind==='product'?'Товар найден · наличие уточните':h.kind==='service'?'Стоимость и время записи уточните':'Наличие товара уточните'}</small>
   <div className="nearby-card-actions">
    {h.kind==='product'&&h.evidence==='search-index'&&h.price!==null&&<small>Цена из поискового фрагмента · уточните у продавца</small>}
    {h.product&&h.shop?.chatAvailable&&<a href={'/messages?product='+encodeURIComponent(h.product.id)}><MessageCircle size={15}/>Написать продавцу</a>}
   {h.kind==='product'&&sourceUrl&&<a href={sourceUrl} target="_blank" rel="noreferrer" onClick={()=>trackProductEvent('seller_click',h.city)}><ExternalLink size={15}/>Товар у продавца</a>}
    {route&&<a className="nearby-route" href={route} target="_blank" rel="noreferrer" onClick={()=>trackProductEvent('route_click',h.city)}><Navigation size={15}/>Маршрут</a>}
    <button type="button" aria-expanded={expanded} onClick={()=>void openDetails()} disabled={loading}>{loading?'Открываем…':expanded?'Скрыть подробности':'Описание и контакты'}</button>
   </div>
   {error&&<p role="alert">{error}</p>}
   {expanded&&details&&<div className="nearby-card-details"><h3>Описание и контакты</h3>
    {details.description?<p className="nearby-description">{details.description}</p>:h.kind==='product'&&<p>Описание товара не опубликовано в источнике.</p>}
    {details.hours&&<p>{details.hours}</p>}
    {phoneHref&&<a href={phoneHref} onClick={()=>trackProductEvent('phone_click',h.city)}><Phone size={14}/>{phone}</a>}
    {website&&<a href={website} target="_blank" rel="noreferrer" onClick={()=>trackProductEvent('seller_click',h.city)}><ExternalLink size={14}/>{h.kind==='product'?'Товар у продавца':'Сайт продавца'}</a>}
    {site&&site!==website&&<a href={site} target="_blank" rel="noreferrer">Сайт магазина</a>}
    {!!h.characteristics?.length&&<dl>{h.characteristics.map(item=><div key={item.name}><dt>{item.name}</dt><dd>{item.value}</dd></div>)}</dl>}
    {!phoneHref&&!website&&<p>Контакты пока не опубликованы.</p>}
   </div>}
  </div>
 </article></>;
}
function ResultImage({src,title}:{src:string|null;title:string}){
 const [failed,setFailed]=useState(false);
 return <div className="nearby-card-image">{src&&!failed?<img src={src} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<img className="nearby-logo" src="/favicon.svg" alt="Фото не опубликовано" loading="eager"/>}</div>;
}
