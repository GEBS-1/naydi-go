'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {MapPin,Navigation,Store} from 'lucide-react';
import {onMap,type Offer} from '@/lib/discovery';
import type {Shop} from '@/lib/model';
import {FavoriteButton} from '../personal';
import {routeTo} from '../store-contacts';
import {money} from '@/lib/model';

type Point={lat:number;lng:number};
type MapShop=Pick<Shop,'id'|'name'|'city'|'street'|'lat'|'lng'|'addressConfirmed'|'category'>&Partial<Pick<Shop,'source'>>;

export function Evidence({offer:o}:{offer:Offer}){return <div className="finder-evidence">{o.address&&<p><MapPin size={14}/>{o.address}{o.distanceKm!==null&&` · ${o.distanceKm.toFixed(1)} км по прямой`}</p>}<p>{o.kind==='service'?'Доступность услуги уточните у продавца':o.confirmed?'Наличие подтверждено магазином':'Наличие уточните у магазина'}</p><p><a href={o.source} target={o.source.startsWith('http')?'_blank':undefined} rel="noopener noreferrer">{o.source.startsWith('http')?'Источник ↗':'Данные магазина в НайдиGo'}</a></p></div>}
export function OfferRow({offer,card}:{offer:Offer;card:ReactNode}){return <article className="finder-offer">{card}<Evidence offer={offer}/><div className="finder-offer-actions"><a href={'#product/'+offer.id}>{offer.kind==='service'?'Об услуге':'К товару'}</a>{onMap(offer.shop)&&<a href={routeTo(offer.shop)} target="_blank" rel="noopener noreferrer"><Navigation size={16}/>Маршрут</a>}</div></article>}

export default function OffersMap({stores,offers,linkedProducts=[],onSelect,onSelectHit,selectedHitId,selectedId,near,onRequestLocation,compact=false,productSearch=false,browse=false,preview=false}:{preview?:boolean;compact?:boolean;productSearch?:boolean;browse?:boolean;stores:MapShop[];offers:Offer[];linkedProducts?:{shopId:string;title:string;price:number|null;id?:string;image?:string|null;route?:string|null;kind?:'product'|'service';sellerConfirmed?:boolean}[];selectedHitId?:string;onSelectHit?:(id:string)=>void;selectedId?:string;near?:Point;onSelect?:(id:string)=>void;onRequestLocation?:()=>void}){
 const points=stores.filter(onMap),[selected,setSelected]=useState(''),[size,setSize]=useState({width:600,height:preview?164:450}),[offset,setOffset]=useState(0),[pan,setPan]=useState({x:0,y:0}),[failed,setFailed]=useState(false),[focusNear,setFocusNear]=useState(true);
 const {width,height}=size;
 const ref=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;baseX:number;baseY:number}|null>(null);
 useEffect(()=>{setSelected(selectedId||'');},[selectedId]);
 useEffect(()=>{const r=new ResizeObserver(e=>setSize({width:e[0].contentRect.width,height:preview?164:Math.max(450,e[0].contentRect.height)}));if(ref.current)r.observe(ref.current);return()=>r.disconnect();},[points.length,preview]);

 useEffect(()=>{
  const map=ref.current;
  if(!map||preview)return;
  const zoom=(event:WheelEvent)=>{
   if(!event.deltaY||(event.target instanceof Element&&event.target.closest('.finder-map-products')))return;
   event.preventDefault();
   const range=browse?6:3;
   setOffset(value=>Math.max(-range,Math.min(range,value+(event.deltaY<0?1:-1))));
   if(!browse)setPan({x:0,y:0});
  };
  map.addEventListener('wheel',zoom,{passive:false});
  return()=>map.removeEventListener('wheel',zoom);
 },[points.length, !!near,browse,preview]);
 const withProducts=new Set(linkedProducts.map(item=>item.shopId));
 const shop=points.find(s=>s.id===selected)||(browse?undefined:points[0]);
 const shopProducts=shop?linkedProducts.filter(item=>item.shopId===shop.id):[];
 const selectedProduct=shopProducts.find(item=>item.id===selectedHitId)||shopProducts[0];
 if(!points.length&&!near)return <div className="finder-map-empty"><MapPin size={36}/><h3>{browse?'В этом городе пока нет объявлений на карте':'Здесь будут места рядом'}</h3><p>{browse?'Выберите другой город или разместите первый товар.':'Укажите свою точку и найдите нужный товар.'}</p>{onRequestLocation&&<button onClick={onRequestLocation}><Navigation size={16}/>Показать моё место</button>}</div>;
 const project=(s:Point)=>[(s.lng+180)/360,(1-Math.log(Math.tan(s.lat*Math.PI/180)+1/Math.cos(s.lat*Math.PI/180))/Math.PI)/2];
 const all:Point[]=near?[...points,near]:points,ps=all.map(project),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const fitX=Math.max(100,width-60)/(256*(maxX-minX||.001));
 const fitY=(height-(preview?44:120))/(256*(maxY-minY||.001));
 const focus=browse&&!preview&&focusNear?near:undefined;
 const center=focus?project(focus):[(minX+maxX)/2,(minY+maxY)/2];
 const fit=focus?13:Math.max(3,Math.min(15,Math.floor(Math.log2(Math.min(fitX,fitY)))));
 const z=Math.max(3,Math.min(18,fit+offset)),scale=256*2**z,panScale=2**(z-fit),baseLeft=center[0]*scale-width/2,baseTop=center[1]*scale-height/2,left=baseLeft-pan.x*panScale,top=baseTop-pan.y*panScale;
 const tiles:ReactNode[]=[];const tileCount=2**z;for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.max(0,Math.floor(top/256));y<=Math.min(tileCount-1,Math.floor((top+height)/256));y++){const wrappedX=((x%tileCount)+tileCount)%tileCount;tiles.push(<image key={`${z}/${x}/${y}`} href={`https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`} x={x*256-left} y={y*256-top} width={256} height={256} onError={()=>setFailed(true)}/>);}
 const xy=(p:Point)=>{const q=project(p);return [q[0]*scale-left,q[1]*scale-top];};
 if(preview)return <div className="finder-map home-mini-map" ref={ref}>
  <svg width="100%" height={height} role="img" aria-label="Ближайшие точки объявлений">{tiles}{points.map(point=>{
   const [x,y]=xy(point);
   return <circle key={point.id} cx={x} cy={y} r={7} fill="#21a43c" stroke="white" strokeWidth={2}/>;
  })}{near&&(()=>{const [x,y]=xy(near);return <circle cx={x} cy={y} r={6} fill="#087d4f" stroke="white" strokeWidth={2}/>;})()}</svg>
  <a className="finder-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
 </div>;
 function centerMe(){if(!near){onRequestLocation?.();return;}if(browse){setFocusNear(true);setOffset(0);setPan({x:0,y:0});return;}const p=project(near);setPan({x:(width/2-(p[0]*scale-baseLeft))/panScale,y:(height/2-(p[1]*scale-baseTop))/panScale});}
 return <div className="finder-map finder-map-interactive" ref={ref} onPointerDown={e=>{if((e.target as Element).closest('button,a,g'))return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,baseX:pan.x,baseY:pan.y};}} onPointerMove={e=>{const d=drag.current;if(d?.id===e.pointerId)setPan({x:d.baseX+(e.clientX-d.x)/panScale,y:d.baseY+(e.clientY-d.y)/panScale});}} onPointerUp={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
  <svg width="100%" height={height} aria-label={browse?'Карта объявлений':'Интерактивная карта магазинов'}>{tiles}{near&&(()=>{const [x,y]=xy(near);return <g aria-label="Ваше местоположение"><circle cx={x} cy={y} r="16" fill="#087d4f" fillOpacity=".2"/><circle cx={x} cy={y} r="7" fill="#087d4f" stroke="white" strokeWidth="3"/></g>;})()}{points.map((s,i)=>{const [x,y]=xy(s);const related=linkedProducts.filter(item=>item.shopId===s.id);const unconfirmed=productSearch&&!related.length;const pointKind=browse?'seller':unconfirmed?'store':related.some(item=>item.sellerConfirmed)?'seller':related.some(item=>item.kind==='service')?'service':'web';const color={store:'#a96812',seller:'#21a43c',service:'#8438d8',web:'#0672ff'}[pointKind];return <g key={s.id} data-point-kind={pointKind} role="button" tabIndex={0} aria-pressed={shop?.id===s.id} aria-label={'Показать '+s.name} onClick={()=>{setSelected(s.id);onSelect?.(s.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(s.id);onSelect?.(s.id);}}}><circle cx={x} cy={y} r={18} fill={color} stroke="white" strokeWidth={3}/><text x={x} y={y+5} fill="white" textAnchor="middle">{i+1}</text></g>})}</svg>
  {productSearch&&points.length>0&&<div className="finder-map-legend" aria-label="Обозначения точек">
   {linkedProducts.some(item=>item.sellerConfirmed)&&<span><i style={{background:'#21a43c'}}/>От продавца НайдиGo</span>}
   {linkedProducts.some(item=>!item.sellerConfirmed&&item.kind!=='service')&&<span><i/>Найдено в интернете</span>}
   {linkedProducts.some(item=>item.kind==='service')&&<span><i style={{background:'#8438d8'}}/>Услуга</span>}
   {points.some(point=>!withProducts.has(point.id))&&<span><i className="fallback-dot"/>Магазин для уточнения</span>}
  </div>}
  <div className="finder-map-buttons"><button onClick={()=>{setOffset(n=>Math.min(n+1,browse?6:3));if(!browse)setPan({x:0,y:0});}} aria-label="Приблизить">+</button><button onClick={()=>{setOffset(n=>Math.max(n-1,browse?-6:-3));if(!browse)setPan({x:0,y:0});}} aria-label="Отдалить">−</button><button onClick={centerMe} aria-label="Показать моё место"><Navigation size={16}/></button><button onClick={()=>{setFocusNear(false);setOffset(0);setPan({x:0,y:0});if(browse)onSelect?.('');}} aria-label="Показать все точки">Все</button></div>
  {!browse&&(shop?<div className="finder-map-card"><Store size={22}/><div>{compact?<b>{shop.name}</b>:shop.source?.startsWith('http')?<a href={shop.source} target="_blank" rel="noreferrer"><b>{shop.name}</b></a>:<a href={'#store/'+shop.id}><b>{shop.name}</b></a>}<p>{shop.street}</p>{!compact&&<FavoriteButton item={{id:shop.id.startsWith('osm:')?shop.id:'store:'+shop.id,title:shop.name,kind:'store',city:shop.city,url:shop.source?.startsWith('http')?shop.source:'#store/'+shop.id}}/>}{(()=>{const items=shopProducts;if(compact&&!items.length&&!offers.some(o=>o.shop.id===shop.id))return productSearch?<p>Наличие товара уточните в магазине.</p>:null;const first=selectedProduct?`${selectedProduct.title}${selectedProduct.price===null?'':' · '+money(selectedProduct.price)}`:offers.find(o=>o.shop.id===shop.id)?.product.name||shop.category;return <p>{first}{items.length>1?` · ещё ${items.length-1}`:''}</p>;})()}<a className="finder-primary" href={selectedProduct?.route||routeTo(shop,near)} target="_blank" rel="noopener noreferrer">Маршрут<Navigation size={16}/></a></div></div>:<div className="finder-map-card"><Navigation size={22}/><div><b>Ваше местоположение</b><p>Рядом пока нет точек продавцов с подтверждённым адресом.</p></div></div>)}
  {!browse&&shopProducts.length>0&&<div className="finder-map-products" aria-label="Товары в выбранной точке">{shopProducts.map((item,i)=><button type="button" key={item.id||i} aria-pressed={item===selectedProduct} onClick={()=>item.id&&onSelectHit?.(item.id)}>{item.image&&<img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>}<span>{item.title}<b>{item.price===null?'Цена не указана':money(item.price)}</b></span></button>)}</div>}
  {!near&&onRequestLocation&&<button className="finder-map-location" onClick={onRequestLocation}><Navigation size={16}/>Показать, где я</button>}{failed&&<p className="finder-map-warning">Подложка недоступна. Адреса и маршруты доступны в карточках.</p>}<a className="finder-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
 </div>;
}
