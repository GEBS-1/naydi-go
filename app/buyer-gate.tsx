'use client';

import type {MouseEvent,ReactNode} from 'react';

type BuyerState={user:{name:string;provider:string}|null};
let cached:boolean|null=null;
let pending:Promise<boolean>|null=null;

async function signedIn(){
 if(cached!==null)return cached;
 if(!pending)pending=fetch('/api/buyer/me',{cache:'no-store'}).then(async response=>{
  if(!response.ok)return false;
  const body=await response.json() as BuyerState;
  return !!body.user;
 }).catch(()=>false).finally(()=>{pending=null;});
 cached=await pending;
 return cached;
}

function returnPath(){return location.pathname+location.search+location.hash;}

export async function requireBuyerAccess(reason='продолжить действие'){
 if(await signedIn())return true;
 const back=returnPath();
 try{
  sessionStorage.setItem('ng_auth_return',back);
  sessionStorage.setItem('ng_auth_reason',reason);
 }catch{/* Storage may be unavailable in private browsing. */}
 location.assign('/account?return_to='+encodeURIComponent(back));
 return false;
}

export function BuyerGateLink({href,children,className,onAllowed}:{href:string;children:ReactNode;className?:string;onAllowed?:()=>void}){
 async function open(event:MouseEvent<HTMLAnchorElement>){
  event.preventDefault();
  if(!await requireBuyerAccess('открыть контакты продавца'))return;
  onAllowed?.();
  location.assign(href);
 }
 return <a className={className} href={href} onClick={event=>void open(event)}>{children}</a>;
}

export function resetBuyerAccessCache(){cached=null;}
