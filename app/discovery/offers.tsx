'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {MapPin,Navigation,Store} from 'lucide-react';
import {onMap,type Offer} from '@/lib/discovery';
import type {Shop} from '@/lib/model';
import {FavoriteButton} from '../personal';
import {routeTo} from '../store-contacts';

type Point={lat:number;lng:number};

export function Evidence({offer:o}:{offer:Offer}){return <div className="finder-evidence"><p><MapPin size={14}/>{o.address||'Адрес не подтверждён'}{o.distanceKm!==null&&` · ${o.distanceKm.toFixed(1)} км по прямой`}</p><p>{o.kind==='service'?'Услуга · доступность и сроки уточняйте':o.confirmed?'Остаток указан магазином':'Наличие в физическом магазине не подтверждено'}</p><p><a href={o.source} target={o.source.startsWith('http')?'_blank':undefined} rel="noopener noreferrer">{o.source.startsWith('http')?'Первоисточник ↗':'Данные магазина в НайдиGo'}</a><span>{o.checkedAt?' · Проверено '+new Date(o.checkedAt).toLocaleDateString('ru-RU'):' · Дата проверки не указана'}</span></p></div>}
export function OfferRow({offer,card}:{offer:Offer;card:ReactNode}){return <article className="finder-offer">{card}<Evidence offer={offer}/><div className="finder-offer-actions"><a href={'#product/'+offer.id}>{offer.kind==='service'?'Об услуге':'К товару'}</a>{onMap(offer.shop)&&<a href={routeTo(offer.shop)} target="_blank" rel="noopener noreferrer"><Navigation size={16}/>Маршрут</a>}</div></article>}

export default function OffersMap({stores,offers,onSelect,selectedId,near,onRequestLocation}:{stores:Shop[];offers:Offer[];selectedId?:string;near?:Point;onSelect?:(id:string)=>void;onRequestLocation?:()=>void}){
 const points=stores.filter(onMap),[selected,setSelected]=useState(''),[width,setWidth]=useState(600),[offset,setOffset]=useState(0),[pan,setPan]=useState({x:0,y:0}),[failed,setFailed]=useState(false);
 const ref=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;baseX:number;baseY:number}|null>(null);
 useEffect(()=>{if(selectedId)setSelected(selectedId);},[selectedId]);
 useEffect(()=>{const r=new ResizeObserver(e=>setWidth(e[0].contentRect.width));if(ref.current)r.observe(ref.current);return()=>r.disconnect();},[points.length]);
 const shop=points.find(s=>s.id===selected)||points[0];
 if(!points.length)return <div className="finder-map-empty"><MapPin size={36}/><h3>Нет подтверждённых точек</h3><p>Предложения без проверенного адреса остаются в списке. Случайные точки на карте не показываем.</p>{onRequestLocation&&<button onClick={onRequestLocation}><Navigation size={16}/>Показать моё место</button>}</div>;
 const project=(s:Point)=>[(s.lng+180)/360,(1-Math.log(Math.tan(s.lat*Math.PI/180)+1/Math.cos(s.lat*Math.PI/180))/Math.PI)/2];
 const all:Point[]=near?[...points,near]:points,ps=all.map(project),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),height=450;
 const fitX=Math.max(100,width-60)/(256*(maxX-minX||.001));
 const fitY=(height-120)/(256*(maxY-minY||.001));
 const fit=Math.min(15,Math.floor(Math.log2(Math.min(fitX,fitY))));
 const z=Math.max(3,Math.min(18,fit+offset)),scale=256*2**z,baseLeft=(minX+maxX)*scale/2-width/2,baseTop=(minY+maxY)*scale/2-height/2,left=baseLeft-pan.x,top=baseTop-pan.y;
 const tiles:ReactNode[]=[];for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+height)/256);y++)tiles.push(<image key={`${z}/${x}/${y}`} href={`https://tile.openstreetmap.org/${z}/${x}/${y}.png`} x={x*256-left} y={y*256-top} width={256} height={256} onError={()=>setFailed(true)}/>);
 const xy=(p:Point)=>{const q=project(p);return [q[0]*scale-left,q[1]*scale-top];};
 function centerMe(){if(!near){onRequestLocation?.();return;}const p=project(near);setPan({x:width/2-(p[0]*scale-baseLeft),y:height/2-(p[1]*scale-baseTop)});}
 return <div className="finder-map finder-map-interactive" ref={ref} onWheel={e=>{e.preventDefault();setOffset(n=>Math.max(-3,Math.min(3,n+(e.deltaY<0?1:-1))));setPan({x:0,y:0});}} onPointerDown={e=>{if((e.target as Element).closest('button,a,g'))return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,baseX:pan.x,baseY:pan.y};}} onPointerMove={e=>{const d=drag.current;if(d?.id===e.pointerId)setPan({x:d.baseX+e.clientX-d.x,y:d.baseY+e.clientY-d.y});}} onPointerUp={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
  <svg width="100%" height={height} aria-label="Интерактивная карта магазинов">{!failed&&tiles}{near&&(()=>{const [x,y]=xy(near);return <g aria-label="Ваше местоположение"><circle cx={x} cy={y} r="16" fill="#087d4f" fillOpacity=".2"/><circle cx={x} cy={y} r="7" fill="#087d4f" stroke="white" strokeWidth="3"/></g>;})()}{points.map((s,i)=>{const [x,y]=xy(s);return <g key={s.id} role="button" tabIndex={0} aria-label={'Показать '+s.name} onClick={()=>{setSelected(s.id);onSelect?.(s.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(s.id);onSelect?.(s.id);}}}><circle cx={x} cy={y} r={18} fill={shop.id===s.id?'#0043cb':'#0672ff'} stroke="white" strokeWidth={3}/><text x={x} y={y+5} fill="white" textAnchor="middle">{i+1}</text></g>})}</svg>
  <div className="finder-map-buttons"><button onClick={()=>{setOffset(n=>Math.min(n+1,3));setPan({x:0,y:0});}} aria-label="Приблизить">+</button><button onClick={()=>{setOffset(n=>Math.max(n-1,-3));setPan({x:0,y:0});}} aria-label="Отдалить">−</button><button onClick={centerMe} aria-label="Показать моё место"><Navigation size={16}/></button><button onClick={()=>{setOffset(0);setPan({x:0,y:0});}} aria-label="Показать все точки">Все</button></div>
  <div className="finder-map-card"><Store size={22}/><div><a href={shop.source?.startsWith('http')?shop.source:'#store/'+shop.id}><b>{shop.name}</b></a><p>{shop.street}</p><FavoriteButton item={{id:shop.id.startsWith('osm:')?shop.id:'store:'+shop.id,title:shop.name,kind:'store',city:shop.city,url:shop.source?.startsWith('http')?shop.source:'#store/'+shop.id}}/><p>{offers.find(o=>o.shop.id===shop.id)?.product.name||shop.category}</p><a className="finder-primary" href={routeTo(shop,near)} target="_blank" rel="noopener noreferrer">Маршрут<Navigation size={16}/></a></div></div>
  {!near&&onRequestLocation&&<button className="finder-map-location" onClick={onRequestLocation}><Navigation size={16}/>Показать, где я</button>}{failed&&<p className="finder-map-warning">Подложка недоступна. Адреса и маршруты доступны в карточках.</p>}<a className="finder-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
 </div>;
}
