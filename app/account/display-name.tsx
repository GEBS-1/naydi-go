'use client';
import {useEffect,useId,useState,type FormEvent} from 'react';
import './display-name.css';

export default function DisplayName({name,onSaved}:{name:string;onSaved:(name:string)=>void}){
 const id=useId();
 const [value,setValue]=useState(name);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>setValue(name),[name]);

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setBusy(true);
  setError('');
  setNotice('');
  try{
   const response=await fetch('/api/buyer/me',{
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:value.trim()}),
   });
   const result=await response.json() as {user?:{name:string};error?:string};
   if(!response.ok||!result.user)throw Error(result.error||'Не удалось сохранить имя.');
   setValue(result.user.name);
   onSaved(result.user.name);
   setNotice('Имя сохранено.');
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }

 return <form className="account-display-name" onSubmit={event=>void save(event)}>
  <label htmlFor={id}>Как вас называть?</label>
  <p id={id+'-hint'}>Это имя увидят продавцы в переписке.</p>
  <div className="account-display-name-fields">
   <input id={id} aria-describedby={id+'-hint'} autoComplete="nickname" value={value} required minLength={2} maxLength={100}
    onChange={event=>{setValue(event.target.value);setNotice('');setError('');}}/>
   <button className="d-btn" type="submit" disabled={busy||value.trim().length<2||value.trim()===name}>{busy?'Сохраняем…':'Сохранить имя'}</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  <p role="status">{notice}</p>
 </form>;
}
