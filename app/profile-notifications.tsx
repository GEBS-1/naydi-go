'use client';
import {useEffect,useState} from 'react';
import {Bell,MessageCircle,Package} from 'lucide-react';
import type {Product,Shop} from '@/lib/model';

type Thread={id:string;productName:string;otherName:string;unread:number};
export default function ProfileNotifications({products,stores}:{products:Product[];stores:Shop[]}){
 const [threads,setThreads]=useState<Thread[]>([]),[loaded,setLoaded]=useState(false);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/messages',{cache:'no-store',signal:controller.signal}).then(async response=>response.ok?await response.json() as {threads?:Thread[]}:null).then(data=>setThreads(data?.threads||[])).catch(()=>{}).finally(()=>setLoaded(true));return()=>controller.abort();},[]);
 const unread=threads.filter(thread=>thread.unread>0);
 const pending=products.filter(product=>product.published&&product.quantity!==0&&stores.some(store=>store.id===product.storeId&&store.visibility!=='public'));
 return <section className="profile-notifications" id="profile-notifications" aria-labelledby="profile-notifications-title"><h2 id="profile-notifications-title"><Bell size={21}/> Уведомления</h2>
  {!loaded?<p>Проверяем сообщения…</p>:unread.length===0&&pending.length===0?<p>Новых событий нет.</p>:<div className="profile-notification-list">
   {unread.map(thread=><a key={thread.id} href={'/messages?thread='+encodeURIComponent(thread.id)}><MessageCircle size={18}/><span><b>{thread.unread} новых сообщений</b><small>{thread.productName} · {thread.otherName}</small></span></a>)}
   {pending.map(product=><a key={product.id} href={'/sell?edit='+encodeURIComponent(product.id)}><Package size={18}/><span><b>Объявление на проверке</b><small>{product.name}</small></span></a>)}
  </div>}
 </section>;
}
