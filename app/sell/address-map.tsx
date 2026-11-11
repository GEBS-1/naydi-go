'use client';
import {useEffect,useRef,useState} from 'react';
import type {ListingPoint} from '@/lib/listing-guide';

type Point={lat:number;lng:number};
const project=(p:Point)=>{const lat=Math.max(-85,Math.min(85,p.lat))*Math.PI/180;return {x:(p.lng+180)/360,y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2};};
const unproject=(x:number,y:number):Point=>({lng:x*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI});

export default function AddressMap({center,point,onPick}:{center:Point;point:ListingPoint|null;onPick:(p:Point)=>void}){
 const ref=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;panX:number;panY:number;id:number;moved:boolean}|null>(null);
 const [width,setWidth]=useState(360),[zoom,setZoom]=useState(point?17:12),[pan,setPan]=useState({x:0,y:0}),[failed,setFailed]=useState(false);
 useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{setPan({x:0,y:0});setZoom(point?17:12);setFailed(false);},[center.lat,center.lng]);
 const scale=256*2**zoom,p=project(center),height=320,left=p.x*scale-width/2-pan.x,top=p.y*scale-height/2-pan.y,tiles=[];
 for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+height)/256);y++){
  if(y<0||y>=2**zoom)continue;
  const tileX=((x%2**zoom)+2**zoom)%2**zoom;
  tiles.push(<img key={`${zoom}/${x}/${y}`} src={`https://tile.openstreetmap.org/${zoom}/${tileX}/${y}.png`} alt="" draggable={false} referrerPolicy="strict-origin-when-cross-origin" onError={()=>setFailed(true)} style={{position:'absolute',left:x*256-left,top:y*256-top,width:256,height:256,maxWidth:'none',pointerEvents:'none'}}/>);
 }
 const marker=point?project(point):null;
 function changeZoom(n:number){const next=Math.max(3,Math.min(19,zoom+n)),factor=2**(next-zoom);setZoom(next);setPan(value=>({x:value.x*factor,y:value.y*factor}));}
 return <>
  <div ref={ref} className="seller-address-map" aria-label="Выбор дома на карте" onPointerDown={e=>{
   if((e.target as Element).closest('button,a')||e.button!==0)return;
   e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y,id:e.pointerId,moved:false};
  }} onPointerMove={e=>{const d=drag.current;if(d?.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>7)d.moved=true;if(d.moved)setPan({x:d.panX+dx,y:d.panY+dy});}}
  onPointerCancel={()=>{drag.current=null;}} onPointerUp={e=>{const d=drag.current;drag.current=null;if(!d||d.id!==e.pointerId||d.moved)return;const r=e.currentTarget.getBoundingClientRect();const picked=unproject((left+e.clientX-r.left)/scale,(top+e.clientY-r.top)/scale);if(Math.abs(picked.lat)<=85&&Math.abs(picked.lng)<=180)onPick(picked);}}>
   {tiles}
   {marker&&<span className="seller-address-pin" style={{left:marker.x*scale-left,top:marker.y*scale-top}} aria-label="Выбранная точка">●</span>}
   <div className="seller-address-tools"><button type="button" aria-label="Приблизить карту" onClick={()=>changeZoom(1)}>+</button><button type="button" aria-label="Отдалить карту" onClick={()=>changeZoom(-1)}>−</button><button type="button" onClick={()=>setPan({x:0,y:0})}>К точке</button><button type="button" onClick={()=>onPick(unproject((left+width/2)/scale,(top+height/2)/scale))}>Выбрать центр</button></div>
   <a className="seller-address-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>
  {failed&&<p role="status">Карта временно недоступна. Выберите адрес из подсказок выше.</p>}
 </>;
}
