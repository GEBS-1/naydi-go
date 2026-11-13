'use client';
import {useEffect,useState} from 'react';
import {Search,Plus,MessageCircle,Heart,UserRound} from 'lucide-react';
import './primary-site-nav.css';

export default function PrimarySiteNav({current,mobile=false}:{current?:'Поиск'|'Разместить'|'Чаты'|'Избранное'|'Профиль';mobile?:boolean}){
 const [accountName,setAccountName]=useState('');
 useEffect(()=>{if(mobile)return;let active=true;const controller=new AbortController();async function refresh(){try{const response=await fetch('/api/buyer/me?summary=1',{cache:'no-store',signal:controller.signal});if(!response.ok)return;const data=await response.json() as {user?:{name:string}|null};if(active)setAccountName(data.user?.name||'');}catch{}}void refresh();window.addEventListener('pageshow',refresh);window.addEventListener('ng:profile-updated',refresh);return()=>{active=false;controller.abort();window.removeEventListener('pageshow',refresh);window.removeEventListener('ng:profile-updated',refresh);};},[mobile]);
 const resumeSearch=(event:React.MouseEvent<HTMLAnchorElement>)=>{try{const query=sessionStorage.getItem('ng_last_search_query');if(query){event.preventDefault();location.href='/#search/'+encodeURIComponent(query);}}catch{}};
 const items=[
  {label:'Поиск',href:'/#home',icon:Search,onClick:resumeSearch},
  {label:'Разместить',href:'/sell',icon:Plus},
  {label:'Чаты',href:'/messages',icon:MessageCircle},
  {label:'Избранное',href:'/#favorites',icon:Heart},
  {label:'Профиль',href:'/#my',icon:UserRound},
 ] as const;
 return <nav className={mobile?'d-bottom nearby-bottom v3-mobile-nav':'v3-desktop-nav'} aria-label="Основные разделы">{items.map(item=><a key={item.label} href={item.href} onClick={'onClick' in item?item.onClick:undefined} className={current===item.label?'active':undefined} aria-current={current===item.label?'page':undefined} aria-label={item.label==='Профиль'&&accountName&&!mobile?'Профиль: '+accountName:undefined}><item.icon size={mobile?21:17}/>{item.label==='Профиль'&&accountName&&!mobile?accountName:item.label}</a>)}</nav>;
}
