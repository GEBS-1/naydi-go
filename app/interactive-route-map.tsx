'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Navigation} from 'lucide-react';
import type {Point,RoadRoute} from '@/lib/journey';
import type {Shop} from '@/lib/model';

type Result={shop:Shop;extraSeconds:number;via:RoadRoute};

export default function InteractiveRouteMap({route,results,selected,onSelect}:{route:RoadRoute;results:Result[];selected:string;onSelect:(id:string)=>void}){
 const ref=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;baseX:number;baseY:number}|null>(null);
 const [width,setWidth]=useState(800),[zoomOffset,setZoom]=useState(0),[pan,setPan]=useState({x:0,y:0}),[tileError,setTileError]=useState(false);
 useEffect(()=>{const o=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(ref.current)o.observe(ref.current);return()=>o.disconnect();},[]);
 const height=390,project=(p:Point)=>{const lat=Math.max(-85,Math.min(85,p.lat))*Math.PI/180;return [(p.lng+180)/360,(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2];};
 const projected=[...route.points,...results.map(r=>r.shop)].map(project),xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const fitX=Math.max(100,width-60)/(256*(maxX-minX||.001)),fitY=(height-60)/(256*(maxY-minY||.001)),fit=Math.floor(Math.log2(Math.min(fitX,fitY))),z=Math.max(3,Math.min(18,fit+zoomOffset)),scale=256*2**z,baseLeft=(minX+maxX)*scale/2-width/2,baseTop=(minY+maxY)*scale/2-height/2,left=baseLeft-pan.x,top=baseTop-pan.y;
 const xy=(p:Point)=>{const a=project(p);return [a[0]*scale-left,a[1]*scale-top];},tiles:ReactNode[]=[];
 for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+height)/256);y++)tiles.push(<img key={`${z}/${x}/${y}`} src={`https://tile.openstreetmap.org/${z}/${x}/${y}.png`} alt="" width={256} height={256} style={{position:'absolute',left:x*256-left,top:y*256-top,width:256,height:256,maxWidth:'none'}} onError={()=>setTileError(true)}/>);
 const origin=route.points[0];
 function centerOrigin(){const p=project(origin);setPan({x:width/2-(p[0]*scale-baseLeft),y:height/2-(p[1]*scale-baseTop)});}
 return <div className="journey-map journey-map-interactive" ref={ref} onWheel={e=>{e.preventDefault();setZoom(n=>Math.max(-2,Math.min(3,n+(e.deltaY<0?1:-1))));setPan({x:0,y:0});}} onPointerDown={e=>{if((e.target as Element).closest('button,a,g'))return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,baseX:pan.x,baseY:pan.y};}} onPointerMove={e=>{const d=drag.current;if(d?.id===e.pointerId)setPan({x:d.baseX+e.clientX-d.x,y:d.baseY+e.clientY-d.y});}} onPointerUp={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
  <div className="journey-tiles" aria-hidden="true">{tiles}</div>
  <svg width="100%" height={height} role="img" aria-label="Интерактивный маршрут и подходящие магазины">
   <polyline points={route.points.map(p=>xy(p).join(',')).join(' ')} fill="none" stroke="white" strokeWidth="8"/>
   <polyline points={route.points.map(p=>xy(p).join(',')).join(' ')} fill="none" stroke="#0866ff" strokeWidth="4"/>
   {[origin,route.points.at(-1)!].map((p,i)=>{const [x,y]=xy(p);return <g key={i}><circle cx={x} cy={y} r="13" fill={i?'#14243b':'#087d4f'} stroke="white" strokeWidth="2"/><text x={x} y={y+5} textAnchor="middle" fill="white" fontSize="13">{i?'Б':'Я'}</text></g>;})}
   {results.map((r,i)=>{const [x,y]=xy(r.shop);return <g key={r.shop.id} role="button" tabIndex={0} aria-label={r.shop.name} onClick={()=>onSelect(r.shop.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.shop.id);}}} style={{cursor:'pointer'}}><circle cx={x} cy={y} r="16" fill={selected===r.shop.id?'#087d4f':'#0866ff'} stroke="white" strokeWidth="3"/><text x={x} y={y+5} textAnchor="middle" fill="white">{i+1}</text></g>;})}
  </svg>
  <div className="journey-map-tools"><button aria-label="Приблизить карту" onClick={()=>{setZoom(n=>Math.min(n+1,3));setPan({x:0,y:0});}}>+</button><button aria-label="Отдалить карту" onClick={()=>{setZoom(n=>Math.max(n-1,-2));setPan({x:0,y:0});}}>−</button><button onClick={centerOrigin} aria-label="Показать начало маршрута"><Navigation size={15}/></button><button onClick={()=>{setZoom(0);setPan({x:0,y:0});}}>Весь путь</button></div>
  {tileError&&<p className="journey-map-warning">Подложка карты недоступна. Линия маршрута и список сохранены.</p>}<a className="journey-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · маршруты Valhalla</a>
 </div>;
}
