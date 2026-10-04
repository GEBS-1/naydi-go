'use client';
import {useState} from 'react';
import {trackProductEvent} from '@/lib/product-events';
import {MapPin,Phone} from 'lucide-react';
import {routeHit,type SearchHit} from '@/lib/city-search';
import {FavoriteButton} from '../personal';
import {money} from '@/lib/model';

export default function ResultCard({hit:h,onMap}:{hit:SearchHit;onMap?:(id:string)=>void}){
 const href=h.product?'#product/'+h.product.id:h.shop?'#store/'+h.shop.id:h.site||h.source;
 return <article className="search-hit">
  <CardImage src={h.image} alt={h.title}/>
  <div>
   <small>{h.kind==='product'?'Товар':h.kind==='service'?'Услуга / мастерская':h.kind==='page'?'Страница в интернете':'Подходящая организация'}</small>
   <a onClick={()=>{if(href.startsWith('http'))trackProductEvent('seller_click',h.city,h.category)}} href={href} target={href.startsWith('http')?'_blank':undefined} rel="noreferrer"><h2>{h.title}</h2></a>
   {h.price!==null?<strong>{money(h.price)}</strong>:<strong>Уточнить цену</strong>}
   {h.seller&&<p>Продавец / сайт: {h.seller}</p>}
   {h.priceEvidence&&<small>Цена опубликована в источнике · не подтверждает наличие в филиале</small>}
   <p>{h.description}</p>
   {h.address&&<p><MapPin size={14}/>{h.city?h.city+', ':''}{h.address}{h.distanceKm!==null?` · ${h.distanceKm.toFixed(1)} км по прямой`:''}</p>}
   {h.locationSource&&<p><a href={h.locationSource} target="_blank" rel="noreferrer">Адрес продавца по данным карты</a> · наличие товара в этой точке не подтверждено</p>}
   {h.hours&&<p>Часы работы: {h.hours}</p>}
   {h.sourceAvailability==='out_of_stock'&&<p className="search-unconfirmed">На сайте продавца: нет в наличии</p>}
   <p className="search-unconfirmed">{h.status==='seller-confirmed'?'Данные о наличии предоставлены продавцом':h.status==='organization'?'Доступность уточняйте у продавца':'Опубликовано на сайте · наличие в конкретной точке уточняется'}</p>
   <div className="search-hit-actions">
    <FavoriteButton item={{id:h.product?'product:'+h.product.id:h.shop?'store:'+h.shop.id:h.id,title:h.title,kind:h.kind,url:href,city:h.city,price:h.price,checkedAt:h.checkedAt}}/>
    {h.site&&<a onClick={()=>trackProductEvent('seller_click',h.city,h.category)} href={h.site} target="_blank" rel="noreferrer">Открыть сайт ↗</a>}
    {h.phone&&<a onClick={()=>trackProductEvent('phone_click',h.city,h.category)} href={'tel:'+h.phone.split(';')[0].replace(/[^+\d]/g,'')}><Phone size={15}/>Позвонить</a>}
    {routeHit(h)&&<><a onClick={()=>trackProductEvent('route_click',h.city,h.category)} href={routeHit(h)!} target="_blank" rel="noreferrer">Маршрут ↗</a>{onMap&&<button onClick={()=>onMap(h.id)}>На карте</button>}</>}
   </div>
   <small><a onClick={()=>{if(h.source.startsWith('http'))trackProductEvent('seller_click',h.city,h.category)}} href={h.source} target={h.source.startsWith('http')?'_blank':undefined} rel="noreferrer">{h.source.includes('openstreetmap.org')?'OpenStreetMap · ODbL':'Источник'}</a>{h.checkedAt?' · Получено '+new Date(h.checkedAt).toLocaleDateString('ru-RU'):''}</small>
  </div>
 </article>;
}
function CardImage({src,alt}:{src:string|null;alt:string}){const [failed,setFailed]=useState(false),fallback=!src||failed;return <div className={'search-hit-image'+(fallback?' branded-fallback':'')}>{fallback?<><img src="/favicon.svg" alt=""/><span>Фото у источника нет</span></>:<img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}</div>}
