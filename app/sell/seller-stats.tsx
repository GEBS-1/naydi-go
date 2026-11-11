'use client';
import {useEffect,useState} from 'react';
type Stats={total:number;published:number;pending:number;conversations:number;unread:number};
export default function SellerStats(){
 const [stats,setStats]=useState<Stats|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true,inflight=false;const controller=new AbortController();async function load(){if(inflight)return;inflight=true;try{const r=await fetch('/api/seller/stats',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const body=await r.json() as Stats;if(active){setStats(body);setError('');}}catch{if(active)setError('Статистика временно недоступна.');}finally{inflight=false;}}void load();const timer=setInterval(()=>{if(!document.hidden)void load();},30000);return()=>{active=false;controller.abort();clearInterval(timer);};},[]);
 return <aside className="business-demo-notice" aria-label="Статистика продавца"><b>Ваши объявления и обращения</b>{stats&&<p>Всего объявлений: {stats.total} · В поиске: {stats.published} · На проверке: {stats.pending}<br/>Диалогов с покупателями: {stats.conversations} · <a href="/messages">Непрочитанных сообщений: {stats.unread}</a></p>}{error&&<p role="status">{error}</p>}<small>Обновляется каждые 30 секунд. Просмотры товаров пока не учитываются. Личности посетителей не показываются.</small></aside>;
}
