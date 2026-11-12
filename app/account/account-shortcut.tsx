'use client';
import {useEffect,useState} from 'react';
import {CircleUserRound} from 'lucide-react';
import './account-shortcut.css';

export default function AccountShortcut({name}:{name?:string}){
 const [loadedName,setLoadedName]=useState('');
 useEffect(()=>{
  if(name!==undefined)return;
  const controller=new AbortController();
  async function refresh(){
   try{
    const response=await fetch('/api/buyer/me?summary=1',{cache:'no-store',signal:controller.signal});
    if(!response.ok)return;
    const data=await response.json() as {user?:{name:string}|null};
    if(!controller.signal.aborted)setLoadedName(data.user?.name||'');
   }catch{/* Keep the account link usable if the profile is temporarily unavailable. */}
  }
  void refresh();
  window.addEventListener('pageshow',refresh);
  return()=>{controller.abort();window.removeEventListener('pageshow',refresh);};
 },[name]);
 const label=name??loadedName;
 return <a href="/account" className="account-shortcut" aria-label={label?'Аккаунт: '+label:'Войти'}>
  <CircleUserRound size={21} aria-hidden="true"/><span>{label||'Войти'}</span>
 </a>;
}
