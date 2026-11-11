'use client';
import {useEffect,useRef,useState} from 'react';
import {sellerProviderLabel,isSellerProvider} from '@/lib/seller-providers';

export default function PhoneImport({phone,onPhone}:{phone:string;onPhone:(phone:string)=>void}){
 const [contact,setContact]=useState<{phone:string;url:string|null;provider:string}|null>(null);
 const [waiting,setWaiting]=useState(false);
 const [error,setError]=useState('');
 const applied=useRef('');
 useEffect(()=>{
  const controller=new AbortController();
  let inflight=false;
  async function load(){
   if(inflight)return;
   inflight=true;
   try{
    const response=await fetch('/api/buyer/phone',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error();
    const data=await response.json() as {phone:string;url:string|null;provider:string};
    if(!controller.signal.aborted){setContact(data);setError('');if(data.phone)setWaiting(false);}
   }catch{if(!controller.signal.aborted)setError('Телефон из мессенджера пока недоступен. Можно ввести вручную.');}
   finally{inflight=false;}
  }
  void load();
  const focus=()=>void load();
  window.addEventListener('focus',focus);
  const timer=waiting?setInterval(()=>{if(!document.hidden)void load();},3000):undefined;
  const timeout=waiting?setTimeout(()=>setWaiting(false),90000):undefined;
  return()=>{controller.abort();window.removeEventListener('focus',focus);clearInterval(timer);clearTimeout(timeout);};
 },[waiting]);
 useEffect(()=>{
  if(!contact?.phone||applied.current===contact.phone)return;
  applied.current=contact.phone;
  if(!phone.trim())onPhone(contact.phone);
 },[contact,phone,onPhone]);
 const provider=contact&&isSellerProvider(contact.provider)?sellerProviderLabel(contact.provider):'мессенджера';
 return <div className="listing-phone-import">
  {contact?.phone&&contact.phone!==phone&&<button className="d-btn secondary" type="button" onClick={()=>onPhone(contact.phone)}>Использовать номер из {provider}</button>}
  {!contact?.phone&&contact?.url&&<a href={contact.url} target="_blank" rel="noopener noreferrer" onClick={()=>setWaiting(true)}>Подставить телефон из {provider}</a>}
  {waiting&&<p role="status">Поделитесь своим номером в боте и вернитесь в форму.</p>}
  {error&&<p role="status">{error}</p>}
 </div>;
}
