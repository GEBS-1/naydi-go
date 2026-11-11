'use client';
import {useEffect} from 'react';
import {emptyPersonal,personalEvent,personalKey,personalSchema,readPersonal,rebasePersonal,type Personal} from '@/lib/personal';

type Copy={data:Personal;version:number};
const ownerKey='ng_personal_active_account_v1';
function saveLocal(data:Personal){const serialized=JSON.stringify(data);if(localStorage.getItem(personalKey)===serialized)return;localStorage.setItem(personalKey,serialized);window.dispatchEvent(new Event(personalEvent));}
async function readAccount():Promise<Copy>{const response=await fetch('/api/buyer/personal',{cache:'no-store'});const body=await response.json() as {data:unknown;version:number;error?:string};if(!response.ok)throw Error(body.error||'Не удалось открыть сохранения аккаунта');return {data:personalSchema.parse(body.data),version:body.version};}
async function writeAccount(copy:Copy):Promise<Copy>{const response=await fetch('/api/buyer/personal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(copy)});if(response.status===409)throw Error('conflict');const body=await response.json() as {data:unknown;version:number;error?:string};if(!response.ok)throw Error(body.error||'Не удалось синхронизировать сохранения');return {data:personalSchema.parse(body.data),version:body.version};}

export default function PersonalAccountSync(){
 useEffect(()=>{
  let cancelled=false,active:Copy|null=null,timer:ReturnType<typeof setTimeout>|null=null,running=false,again=false,marker='';
  function remember(copy:Copy,expectedLocal?:string){if(cancelled)return;active=copy;localStorage.setItem(marker,JSON.stringify(copy));if(expectedLocal!==undefined&&localStorage.getItem(personalKey)!==expectedLocal){again=true;return;}saveLocal(copy.data);}
  async function flush(){if(cancelled||!active)return;if(running){again=true;return;}running=true;try{
   for(let attempt=0;attempt<3;attempt++){
    const local=readPersonal(),snapshot=JSON.stringify(local),current=await readAccount();
    const next=rebasePersonal(current.data,active.data,local);
    if(JSON.stringify(next)===JSON.stringify(current.data)){remember(current,snapshot);break;}
    try{remember(await writeAccount({data:next,version:current.version}),snapshot);break;}catch(error){if((error as Error).message!=='conflict'||attempt===2)throw error;}
   }
  }catch{ /* Keep local data; the next edit or page visit retries. */ }finally{running=false;if(again&&!cancelled){again=false;void flush();}}}
  function changed(){if(cancelled||!active)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>void flush(),900);}
  async function start(){try{
   const response=await fetch('/api/buyer/me?summary=1',{cache:'no-store'});
   if(!response.ok)return;
   const body=await response.json() as {user:{id:string}|null};
   if(!body.user||cancelled)return;
   const id=body.user.id;marker='ng_personal_sync_v1:'+id;
   const previousOwner=localStorage.getItem(ownerKey);
   const raw=localStorage.getItem(marker);
   let saved:Copy|null=null;
   try{if(raw){const value=JSON.parse(raw) as Copy;saved={data:personalSchema.parse(value.data),version:value.version};}}catch{/* Corrupt sync marker does not alter data. */}
   const differentOwner=!!previousOwner&&previousOwner!==id;
   const local=differentOwner?emptyPersonal():readPersonal();
   if(differentOwner)saveLocal(local);
   if(saved&&differentOwner){const current=await readAccount();remember(current);}
   else if(saved){active=saved;await flush();}
   else{const sync=await fetch('/api/buyer/personal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(local)});const value=await sync.json() as {data:unknown;version:number};if(!sync.ok)return;remember({data:personalSchema.parse(value.data),version:value.version});}
   localStorage.setItem(ownerKey,id);
   if(!cancelled){window.addEventListener(personalEvent,changed);if(again){again=false;void flush();}}
  }catch{/* Local favorites remain available. */}}
  void start();return()=>{cancelled=true;if(timer)clearTimeout(timer);window.removeEventListener(personalEvent,changed);};
 },[]);
 return null;
}
