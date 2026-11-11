'use client';

import {useState,type FormEvent} from 'react';

export function AdminPasswordLogin(){
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const password=new FormData(event.currentTarget).get('password');
  setError('');setBusy(true);
  try{
   const response=await fetch('/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
   if(!response.ok){
    const body=await response.json() as {error?:string};
    throw Error(body.error||'Вход недоступен');
   }
   window.location.reload();
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 return <section className="d-panel"><h2>Вход администратора</h2>
  <form className="ng-form" method="post" onSubmit={submit}>
   <label>Пароль<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
   <button className="d-btn" disabled={busy}>{busy?'Проверяем…':'Войти'}</button>
   {error&&<p role="alert">{error}</p>}
  </form>
 </section>;
}

export function AdminPasswordLogout(){
 const [error,setError]=useState('');
 async function logout(){
  try{
   const response=await fetch('/api/admin-login',{method:'DELETE'});
   if(!response.ok)throw Error();
   window.location.reload();
  }catch{setError('Не удалось завершить сеанс. Попробуйте ещё раз.');}
 }
 return <><button className="d-btn secondary" type="button" onClick={()=>void logout()}>Выйти из админки</button>{error&&<p role="alert">{error}</p>}</>;
}
