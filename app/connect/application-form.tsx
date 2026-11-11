'use client';
import {FormEvent,useRef,useState} from 'react';
import {CheckCircle2,X} from 'lucide-react';
import {categories} from '@/lib/model';

/** Short callback form — not the main seller path. Main path is /business-demo. */
export default function ApplicationForm({triggerClass,label='Оставить телефон'}:{triggerClass?:string;label?:string}){
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const form=new FormData(event.currentTarget),phone=String(form.get('phone')||'').trim(),name=String(form.get('contactPerson')||'').trim();
  try{
   const response=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    name:String(form.get('storeName')||name||'Магазин'),contactPerson:name,phone,contact:phone,preferredChannel:'phone',
    city:String(form.get('city')||'Казань'),category:categories[0],catalogUrl:'',catalogConsent:false,
    note:'Короткий callback с /connect — продавец просил перезвонить.',consent:form.get('consent')==='on',website:'',
   })}),body=await response.json() as {error?:string};
   if(!response.ok)throw Error(body.error||'Не удалось отправить');
   setDone(true);
  }catch(reason){setError((reason as Error).message);}
  finally{setBusy(false);}
 }
 function close(){dialog.current?.close();setTimeout(()=>{setDone(false);setError('');},200);}
 return <>
  <button type="button" className={triggerClass} onClick={()=>dialog.current?.showModal()}>{label}</button>
  <dialog className="finder-dialog connect-application" ref={dialog} onClose={()=>{setDone(false);setError('');}}>
   {done?<div className="connect-application-success"><CheckCircle2/><p>ОТПРАВЛЕНО</p><h2>Перезвоним</h2><p>Профиль магазина и товары можно сразу подготовить на странице «Добавить магазин».</p><a className="connect-primary" href="/business-demo">Создать магазин</a><button className="connect-secondary" type="button" onClick={close}>Закрыть</button></div>:
   <><button className="finder-close" type="button" aria-label="Закрыть" onClick={close}><X/></button>
    <p className="connect-kicker">ПЕРЕЗВОН</p>
    <h2>Оставить телефон</h2>
    <p>Три поля. Или сразу соберите витрину сами — это быстрее заявки.</p>
    <form onSubmit={submit}>
     <label>Имя<input name="contactPerson" required minLength={2} maxLength={120} autoComplete="name"/></label>
     <label>Телефон<input name="phone" required minLength={5} maxLength={100} autoComplete="tel" placeholder="+7 …"/></label>
     <label>Город<input name="city" defaultValue="Казань" required maxLength={100}/></label>
     <input type="hidden" name="storeName" value=""/>
     <input className="finder-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"/>
     <label className="finder-consent"><input type="checkbox" name="consent" required/>Согласен на <a href="/legal/personal-consent" target="_blank">обработку данных</a> для ответа на заявку. <a href="/legal/privacy" target="_blank">Политика</a></label>
     {error&&<p className="connect-form-error" role="alert">{error}</p>}
     <button className="connect-primary finder-primary" disabled={busy}>{busy?'Отправляем…':'Жду звонка'}</button>
     <a className="connect-secondary" style={{width:'100%',marginTop:10}} href="/business-demo">Создать магазин самостоятельно</a>
    </form></>}
  </dialog>
 </>;
}
