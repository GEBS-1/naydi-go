'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {Sparkles,X,Search,Plus,Settings,Heart} from 'lucide-react';
import './site-helper.css';

type Area='search'|'sell'|'messages'|'profile'|'favorites'|'other';
function area():Area{
 if(location.pathname==='/sell'||location.pathname==='/business-demo')return 'sell';
 if(location.pathname==='/messages')return 'messages';
 if(location.pathname!=='/')return 'other';
 const hash=location.hash.slice(1).split('/')[0];
 if(hash==='my')return 'profile';
 if(hash==='favorites')return 'favorites';
 return 'search';
}
export default function SiteHelper(){
 const [current,setCurrent]=useState<Area>('other'),[open,setOpen]=useState(false),[query,setQuery]=useState('');
 const currentQuery=typeof window==='undefined'?'':decodeURIComponent(location.hash.match(/^#(?:search|map)\/(.*)$/u)?.[1]||'');
 const mapHref='/#map/'+encodeURIComponent(currentQuery||query.trim());
 useEffect(()=>{const update=()=>{setCurrent(area());setOpen(false);};update();window.addEventListener('hashchange',update);window.addEventListener('popstate',update);const show=()=>setOpen(true);window.addEventListener('ng-open-site-helper',show);return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update);window.removeEventListener('ng-open-site-helper',show);};},[]);
 if(current==='other')return null;
 function search(event:FormEvent){event.preventDefault();const text=query.trim();if(!text)return;setOpen(false);location.href='/#search/'+encodeURIComponent(text);}
 function listingHelp(){const panel=document.getElementById('listing-assistant-panel');const start=document.querySelector<HTMLButtonElement>('.listing-assistant-start');if(start)start.click();else if(!panel){const reopen=document.querySelector<HTMLButtonElement>('.listing-assistant-open');if(reopen)reopen.click();else{location.href='/account?return_to=%2Fsell';return;}}setOpen(false);document.getElementById('listing-assistant-panel')?.scrollIntoView({behavior:'smooth',block:'start'});}
 return <div className="site-helper-root"><button type="button" className="site-helper-trigger" aria-label="Открыть помощника НайдиGo" aria-expanded={open} aria-controls="site-helper-panel" onClick={()=>setOpen(value=>!value)}><Sparkles size={20}/><span>Помощник</span></button>{open&&<section id="site-helper-panel" className="site-helper-panel" role="dialog" aria-label="Помощник НайдиGo"><header><span><Sparkles size={20}/>Помощник НайдиGo</span><button type="button" aria-label="Закрыть помощника" onClick={()=>setOpen(false)}><X size={18}/></button></header>{current==='search'&&<><p>Здравствуйте! Напишите, что хотите найти. Поиск покажет предложения и подтверждённые точки на карте.</p><form onSubmit={search}><label htmlFor="site-helper-query">Что ищем?</label><input id="site-helper-query" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Например: дрель рядом" maxLength={200}/><button type="submit" disabled={!query.trim()}><Search size={16}/>Найти предложения</button></form>{(currentQuery||query.trim())&&<a href={mapHref} onClick={()=>setOpen(false)}>Открыть карту текущего поиска</a>}</>}{current==='sell'&&<><p>Помогу подготовить объявление: заполнить название и описание по тексту или фотографии, затем вы проверите карточку перед публикацией.</p><button type="button" onClick={listingHelp}><Sparkles size={16}/>Открыть помощника объявления</button><a href="/sell#my-listings">Мои объявления</a></>}{current==='messages'&&<><p>Здесь будут переписки по объявлениям. Откройте товар и напишите продавцу, чтобы начать диалог.</p><a href="/#home"><Search size={16}/>Найти товар</a><a href="/sell"><Plus size={16}/>Разместить объявление</a></>}{current==='profile'&&<><p>Здесь можно посмотреть свои объявления, избранное и историю, а имя изменить в настройках аккаунта.</p><a href="/sell#my-listings"><Plus size={16}/>Мои объявления</a><a href="/account"><Settings size={16}/>Изменить имя и настройки</a></>}{current==='favorites'&&<><p>Сохраняйте интересные предложения сердечком. Вернуться к ним можно здесь.</p><a href="/#home"><Search size={16}/>Искать предложения</a><a href="/#my"><Heart size={16}/>Мой профиль</a></>}</section>}</div>;
}
