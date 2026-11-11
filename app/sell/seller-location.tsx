'use client';
import {useEffect,useRef,useState} from 'react';
import {MapPin} from 'lucide-react';
import type {ListingDraft,ListingPoint} from '@/lib/listing-guide';
import AddressMap from './address-map';

export default function SellerLocation({draft,onChange}:{draft:ListingDraft;onChange:(patch:Partial<ListingDraft>)=>void}){
 const selected=draft.selectedCity||(draft.point?{...draft.point,city:draft.city,label:draft.city}:null);
 const [cities,setCities]=useState<ListingPoint[]>([]);
 const [addresses,setAddresses]=useState<ListingPoint[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [locating,setLocating]=useState(false);
 const [retry,setRetry]=useState(0);
 const alive=useRef(true);
 const revision=useRef(0);
 const reverse=useRef<AbortController|null>(null);
 const [mapPoint,setMapPoint]=useState<{lat:number;lng:number;address:string;city:string;region:string}|null>(null);
 const [mapBusy,setMapBusy]=useState(false),[mapError,setMapError]=useState('');
 function cancelMap(){reverse.current?.abort();reverse.current=null;setMapBusy(false);setMapPoint(null);setMapError('');}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;reverse.current?.abort();};},[]);
 const kind=selected?'address':'city';
 const query=selected?draft.street:draft.city;
 useEffect(()=>{
  setCities([]);
  setAddresses([]);
  setError('');
  setBusy(false);
  if(query.trim().length<2||selected&&draft.point)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setBusy(true);
   try{
    const params=new URLSearchParams({kind,q:query,city:draft.city});
    if(selected){params.set('area',selected.label);params.set('lat',String(selected.lat));params.set('lng',String(selected.lng));}
    const response=await fetch('/api/seller/places?'+params,{signal:controller.signal});
    const data=await response.json() as {places?:ListingPoint[];error?:string};
    if(!response.ok)throw Error(data.error||'Не удалось получить подсказки.');
    if(!controller.signal.aborted){
     const places=data.places||[];
     if(kind==='city')setCities(places);else setAddresses(places);
     if(!places.length)setError(kind==='city'?'Город не найден. Уточните название.':'Адрес не найден. Укажите улицу и номер дома.');
    }
   }catch(e){if(!controller.signal.aborted)setError((e as Error).message);}
   finally{if(!controller.signal.aborted)setBusy(false);}
  },400);
  return()=>{clearTimeout(timer);controller.abort();};
 },[kind,query,draft.city,!!draft.point,selected?.label,selected?.lat,selected?.lng,retry]);

 function chooseCity(place:ListingPoint){
  cancelMap();
  revision.current++;
  onChange({city:place.city||place.label,selectedCity:place,street:'',point:null});
  setCities([]);
 }
 async function locate(){
  cancelMap();
  if(!navigator.geolocation){setError('Геолокация недоступна. Введите город.');return;}
  const request=++revision.current;
  setLocating(true);
  setError('');
  navigator.geolocation.getCurrentPosition(async position=>{
   try{
    const response=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:position.coords.latitude,lng:position.coords.longitude})});
    const data=await response.json() as {city?:string;error?:string};
    if(!response.ok||!data.city)throw Error(data.error||'Не удалось определить город.');
    if(alive.current&&request===revision.current){
     onChange({city:data.city,selectedCity:null,street:'',point:null});
     setRetry(value=>value+1);
    }
   }catch(e){if(alive.current&&request===revision.current)setError((e as Error).message);}
   finally{if(alive.current)setLocating(false);}
  },()=>{
   if(alive.current&&request===revision.current){setLocating(false);setError('Доступ к геолокации не получен. Введите город вручную.');}
  },{timeout:10000,maximumAge:60000});
 }
 async function pickPoint(point:{lat:number;lng:number}){
  reverse.current?.abort();const controller=new AbortController();reverse.current=controller;
  setMapPoint({...point,address:'',city:draft.city,region:''});setMapBusy(true);setMapError('');
  try{
   const response=await fetch('/api/seller/address',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(point)});
   const data=await response.json() as {place?:{address:string;city:string;region:string}|null;error?:string};
   if(!response.ok)throw Error(data.error||'Не удалось определить адрес.');
   if(!controller.signal.aborted){
    if(data.place)setMapPoint({...point,...data.place,city:data.place.city||draft.city});
    else setMapError('Номер дома не найден. Впишите адрес выбранной точки.');
   }
  }catch(e){if(!controller.signal.aborted)setMapError((e as Error).message);}
  finally{if(!controller.signal.aborted)setMapBusy(false);}
 }
 const center=draft.point||selected;
 return <section aria-label="Город и адрес">
  <label>Город <small>Выберите подсказку с регионом</small>
   <input id="listing-city" autoComplete="address-level2" maxLength={100} value={draft.city}
    onChange={event=>{cancelMap();revision.current++;onChange({city:event.target.value,selectedCity:null,street:'',point:null});}}/>
  </label>
  <button className="listing-assistant-open" type="button" disabled={locating} onClick={()=>void locate()}><MapPin size={16}/>{locating?'Определяем город…':'Определить город по местоположению'}</button>
  {selected&&<p className="d-fine">Выбран город: {selected.label}</p>}
  {!!cities.length&&<div className="business-address-suggestions" role="listbox" aria-label="Города">
   {cities.map(place=><button type="button" role="option" aria-selected="false" key={place.lat+':'+place.lng} onClick={()=>chooseCity(place)}>{place.label}</button>)}
  </div>}
  <label>Адрес <small>{selected?'Улица и дом · выберите подсказку':'Сначала выберите город'}</small>
   <input id="listing-street" autoComplete="street-address" maxLength={300} disabled={!selected} value={draft.street}
    onChange={event=>{cancelMap();onChange({street:event.target.value,selectedCity:selected,point:null});}} placeholder="Например, улица Баумана, 10"/>
  </label>
  {busy&&<p role="status">Ищем {kind==='city'?'город':'адрес'}…</p>}
  {!!addresses.length&&<div className="business-address-suggestions" role="listbox" aria-label="Адреса">
   {addresses.map(place=><button type="button" role="option" aria-selected="false" key={place.lat+':'+place.lng} onClick={()=>{cancelMap();onChange({street:place.label,point:place});setAddresses([]);}}>{place.label}</button>)}
  </div>}
  {error&&<p role="status">{error} <button className="listing-assistant-open" type="button" onClick={()=>setRetry(value=>value+1)}>Повторить</button></p>}
  {center&&<div className="business-map-preview">
   <p><MapPin size={16}/>Приблизьте карту и нажмите на нужный дом. Адрес появится ниже.</p>
   <AddressMap center={center} point={mapPoint?{...mapPoint,label:mapPoint.address}:draft.point} onPick={p=>void pickPoint(p)}/>
   {mapPoint&&<div className="seller-map-confirm">
    {mapBusy?<p role="status">Определяем адрес…</p>:<>
     <label>Адрес выбранной точки <small>{mapPoint.city}{mapPoint.region?', '+mapPoint.region:''} · проверьте улицу и дом</small><input aria-label="Адрес выбранной точки" value={mapPoint.address} maxLength={300} onChange={e=>setMapPoint({...mapPoint,address:e.target.value})}/></label>
     {mapError&&<p role="status">{mapError}</p>}
     <button className="d-btn" type="button" disabled={mapPoint.address.trim().length<3} onClick={()=>{
      const place={lat:mapPoint.lat,lng:mapPoint.lng,city:mapPoint.city,label:mapPoint.address.trim()};
      onChange({city:mapPoint.city,selectedCity:mapPoint.city===draft.city?selected:{...place,label:[mapPoint.city,mapPoint.region].filter(Boolean).join(', ')},street:place.label,point:place});cancelMap();setAddresses([]);
     }}>Подтвердить адрес</button>
     <button className="listing-assistant-open" type="button" onClick={()=>void pickPoint(mapPoint)}>Определить повторно</button>
    </>}
   </div>}
  </div>}
 </section>;
}
