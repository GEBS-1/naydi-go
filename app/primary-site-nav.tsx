'use client';
import {House,Map,Plus,MessageCircle,Sparkles,UserRound} from 'lucide-react';
import './primary-site-nav.css';

export default function PrimarySiteNav({current,mobile=false}:{current?:'Главная'|'Карта'|'Разместить'|'Чаты'|'ИИ'|'Профиль';mobile?:boolean}){
 const openAssistant=()=>{if(!location.hash.startsWith('#map/'))try{sessionStorage.setItem('ng_open_search_assistant','1');}catch{}window.dispatchEvent(new Event('ng-open-search-assistant'));};
 const items=[
  {label:'Главная',href:'/#home',icon:House},
  {label:'Карта',href:'/#map/',icon:Map},
  {label:'Разместить',href:'/sell',icon:Plus},
  {label:'Чаты',href:'/messages',icon:MessageCircle},
  {label:'ИИ',href:'/#map/',icon:Sparkles,onClick:openAssistant},
  {label:'Профиль',href:'/#my',icon:UserRound},
 ] as const;
 return <nav className={mobile?'d-bottom nearby-bottom v3-mobile-nav':'v3-desktop-nav'} aria-label="Основные разделы">{items.map(item=><a key={item.label} href={item.href} onClick={'onClick' in item?item.onClick:undefined} className={current===item.label?'active':undefined} aria-current={current===item.label?'page':undefined}><item.icon size={mobile?21:17}/>{item.label}</a>)}</nav>;
}
