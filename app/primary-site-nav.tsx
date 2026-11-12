'use client';
import {Search,Plus,MessageCircle,Heart,UserRound} from 'lucide-react';
import './primary-site-nav.css';

export default function PrimarySiteNav({current,mobile=false}:{current?:'Поиск'|'Разместить'|'Чаты'|'Избранное'|'Профиль';mobile?:boolean}){
 const resumeSearch=(event:React.MouseEvent<HTMLAnchorElement>)=>{try{const query=sessionStorage.getItem('ng_last_search_query');if(query){event.preventDefault();location.href='/#search/'+encodeURIComponent(query);}}catch{}};
 const items=[
  {label:'Поиск',href:'/#home',icon:Search,onClick:resumeSearch},
  {label:'Разместить',href:'/sell',icon:Plus},
  {label:'Чаты',href:'/messages',icon:MessageCircle},
  {label:'Избранное',href:'/#favorites',icon:Heart},
  {label:'Профиль',href:'/#my',icon:UserRound},
 ] as const;
 return <nav className={mobile?'d-bottom nearby-bottom v3-mobile-nav':'v3-desktop-nav'} aria-label="Основные разделы">{items.map(item=><a key={item.label} href={item.href} onClick={'onClick' in item?item.onClick:undefined} className={current===item.label?'active':undefined} aria-current={current===item.label?'page':undefined}><item.icon size={mobile?21:17}/>{item.label}</a>)}</nav>;
}
