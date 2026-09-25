'use client';
import {useEffect,useState,type ReactNode} from 'react';
import type {Product,Shop} from '@/lib/model';
import Planner from './planner';
import './planner.css';

export default function AIEntry({id,card,initialTask='',city='Казань'}:{id:string;initialTask?:string;city?:string;card:(p:Product,s:Shop)=>ReactNode}){
  const [ai,setAI]=useState(false),[task,setTask]=useState(initialTask),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{void fetch('/api/discovery').then(async r=>await r.json() as {ai?:boolean}).then(b=>setAI(b.ai===true)).catch(()=>setError('Не удалось проверить подключение ИИ.'));},[]);
  if(id)return <Planner key={id} id={id} ai={ai} card={card}/>;
  return <section className="finder-plan"><a href="#home">← На главную</a><h1>Что хотите подобрать?</h1><p>Опишите задачу. ИИ поможет составить список товаров и услуг; реальные предложения ищем отдельно в каталоге НайдиGo.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',task,city})});const b=await r.json() as {error?:string;plan:{id:string}};if(!r.ok)throw new Error(b.error||'Не удалось создать подборку');location.hash='plan/'+b.plan.id;}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Ваша задача<textarea required minLength={3} maxLength={4000} value={task} onChange={e=>setTask(e.target.value)} placeholder="Например: хочу обустроить рабочее место в небольшой комнате"/></label><button className="finder-primary" disabled={busy}>{busy?'Сохраняем…':'Создать подборку'}</button></form>{error&&<p role="alert" className="finder-error">{error}</p>}<p className="finder-muted">Список сохранится для этого браузера. Перед разбором описание задачи передаётся RouterAI и провайдеру модели по вашему нажатию. Не указывайте личные данные.</p></section>;
}
