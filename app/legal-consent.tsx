'use client';
import {useEffect,useState} from 'react';
import {legalLinks} from '@/lib/legal';

const key='ng_analytics_consent_v1';
export default function LegalConsent(){
 const [choice,setChoice]=useState<string|null>(null),[open,setOpen]=useState(false);
 useEffect(()=>{try{setChoice(localStorage.getItem(key));}catch{setChoice('no');}const show=()=>setOpen(true);document.getElementById('legal-analytics-settings')?.addEventListener('click',show);return()=>document.getElementById('legal-analytics-settings')?.removeEventListener('click',show);},[]);
 function choose(value:'yes'|'no'){const wasEnabled=choice==='yes';try{localStorage.setItem(key,value);}catch{}setChoice(value);setOpen(false);window.dispatchEvent(new Event('ng-analytics-choice'));if(wasEnabled&&value==='no')location.reload();}
 return <><footer className="ng-legal-footer"><span>© НайдиGo</span><a href="/legal/operator">Владелец</a><a href="/legal/terms">Условия</a><a href="/legal/privacy">Персональные данные</a><details><summary>Все документы</summary><div>{legalLinks.map(link=><a key={link.href} href={link.href}>{link.label}</a>)}</div></details><button type="button" onClick={()=>setOpen(true)}>Настройки аналитики</button></footer>{(choice===null||open)&&<div className="ng-cookie-banner" role="dialog" aria-label="Настройки аналитики"><p>Для работы сайта используем необходимые cookie. Яндекс Метрику и Вебвизор включим только с вашего согласия. <a href="/legal/cookies">Подробнее о cookie и аналитике</a>.</p><div><button type="button" onClick={()=>choose('no')}>Только необходимые</button><button type="button" onClick={()=>choose('yes')}>Разрешить аналитику</button></div></div>}</>;
}
