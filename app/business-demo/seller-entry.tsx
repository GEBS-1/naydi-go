'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,MapPin,Navigation,Store,Package,Bike} from 'lucide-react';
import PrimarySiteNav from '../primary-site-nav';
import type {Shop} from '@/lib/model';
import '../design/design.css';
import './style.css';
import ListingEditor from '@/app/sell/listing-editor';
import DisplayName from '@/app/account/display-name';
import {sellerProviderIds,sellerProviderLabel,type SellerProvider} from '@/lib/seller-providers';

type SellerState={user:{name:string;provider:string;demo?:boolean}|null;providers:{telegram:boolean;max:boolean};identities?:string[];shop:(Shop&{submissionStatus?:string})|null};
export function SellerEntry({localTest=false,storeMode=false}:{localTest?:boolean;storeMode?:boolean}){
 const [state,setState]=useState<SellerState|null>(null),[error,setError]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false),[personalConsent,setPersonalConsent]=useState(false);
 const consentInput=useRef<HTMLInputElement>(null);
 const [consentHint,setConsentHint]=useState(false);
 async function refresh(){const r=await fetch('/api/connect?seller=1',{cache:'no-store'});if(!r.ok)throw Error('Не удалось проверить вход.');setState(await r.json() as SellerState);}
 useEffect(()=>{
  async function openAccount(){
   const returnCode=new URLSearchParams(window.location.hash.slice(1)).get('login');
   if(!returnCode){
    try{await fetch('/api/buyer/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status'})});}catch{}
    await refresh();return;
   }
   window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
   setBusy(true);
   try{
    const response=await fetch('/api/buyer/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnCode})});
    const result=await response.json() as {authenticated?:boolean;error?:string};
    if(!response.ok||!result.authenticated)throw Error(result.error||'Не удалось завершить вход.');
   }finally{setBusy(false);await refresh();}
  }
  void openAccount().catch(e=>setError((e as Error).message));
 },[]);
 useEffect(()=>{if(!link)return;let stopped=false,inflight=false;const until=Date.now()+5*60000;async function poll(){if(stopped||inflight||document.hidden)return;if(Date.now()>until){setLink('');setError('Подтверждение устарело. Начните вход ещё раз.');return;}inflight=true;try{const r=await fetch('/api/buyer/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status'})}),b=await r.json() as {authenticated?:boolean;error?:string};if(!r.ok){setError(b.error||'Не удалось подтвердить вход.');setLink('');return;}if(b.authenticated&&!stopped){await refresh();setLink('');}}catch{}finally{inflight=false;}}const timer=setInterval(()=>void poll(),2000);void poll();return()=>{stopped=true;clearInterval(timer);};},[link]);
 async function signIn(provider:SellerProvider){
  if(!state?.user&&!personalConsent){
   setConsentHint(true);
   consentInput.current?.focus();
   return;
  }
  setBusy(true);setError('');try{const r=await fetch('/api/buyer/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,...(state?.user?{action:'link'}:{})})}),b=await r.json() as {url?:string;error?:string};if(!r.ok||!b.url)throw Error(b.error||'Не удалось начать вход.');setLink(b.url);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function demoSignIn(){setBusy(true);setError('');try{const r=await fetch('/api/dev/seller-session',{method:'POST'});if(!r.ok)throw Error('Тестовый вход доступен только локально.');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function signOut(){setBusy(true);setError('');try{const r=await fetch('/api/buyer/auth',{method:'DELETE'});if(!r.ok)throw Error('Не удалось выйти.');setLink('');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(state?.user)return <><details className="business-account seller-account-settings"><summary>Настройки аккаунта</summary><div className="business-account-row"><p>{state.user.demo?'Локальный тестовый аккаунт · без входа в бот':`Вы вошли через ${sellerProviderLabel(state.user.provider)}. Вход сохраняется на 30 дней.`}</p><button className="business-signout" disabled={busy} onClick={()=>void signOut()}>Выйти из аккаунта</button></div>{state.user.demo?<small>Тестовые данные сохраняются только в локальной базе.</small>:<details><summary>Способы входа</summary><p>Подключено: {(state.identities?.length?state.identities:[state.user.provider]).map(sellerProviderLabel).join(', ')}.</p>{sellerProviderIds.filter(p=>p!==state.user?.provider&&!state.identities?.includes(p)).map(p=><button key={p} className="d-btn" disabled={busy||!state.providers[p]} onClick={()=>void signIn(p)}>Привязать {sellerProviderLabel(p)} к этому аккаунту</button>)}{link&&<a href={link} target="_blank" rel="noreferrer">Подтвердить привязку в мессенджере</a>}</details>}<p><strong>Добро пожаловать, {state.user.name}!</strong></p><DisplayName name={state.user.name} onSaved={name=>setState(current=>current?.user?{...current,user:{...current.user,name}}:current)}/>{error&&<p role="alert">{error}</p>}</details><ListingEditor storeMode={storeMode} initialShop={state.shop} accountName={state.user.name}/></>;
 return <main className="business-demo marketplace-flow design unified-seller unified-welcome"><header className="seller-primary-header"><a className="seller-primary-brand" href="/">Найди<span>Go</span></a><PrimarySiteNav current="Разместить"/></header><div className="unified-welcome-grid"><section className="business-step seller-signin"><p className="business-kicker">ЧАСТНЫМ ПРОДАВЦАМ И МАГАЗИНАМ</p><h1>Ваш товар. Покупатель рядом.</h1><p>Разместите объявление по фото за три коротких шага. Название компании можно добавить в той же форме.</p><ol className="unified-welcome-steps"><li><Camera size={22}/><div><b>Фото и цена</b><small>Помощник подготовит карточку</small></div></li><li><MapPin size={22}/><div><b>Место на карте</b><small>Где покупатель заберёт товар</small></div></li><li><Navigation size={22}/><div><b>Покупатели поблизости</b><small>Найдут объявление и построят маршрут</small></div></li></ol><h2>Войдите и разместите товар</h2><p className="d-fine">Telegram или MAX — без отдельного пароля. Черновики и объявления сохраняются в аккаунте.</p>{error&&<p role="alert">{error}</p>}<label className={consentHint?"seller-consent seller-consent-highlight":"seller-consent"}><input ref={consentInput} type="checkbox" checked={personalConsent} aria-describedby={consentHint?"seller-consent-hint":undefined} onChange={e=>{setPersonalConsent(e.target.checked);setConsentHint(false);}}/><span>Принимаю <a href="/legal/terms" target="_blank" rel="noopener">условия сервиса</a> и даю <a href="/legal/personal-consent" target="_blank" rel="noopener">согласие на обработку данных</a> для входа и размещения товара.</span></label><div aria-live="polite">{consentHint&&<p className="seller-consent-hint" id="seller-consent-hint">↑ Поставьте галочку выше, чтобы продолжить вход.</p>}</div>{!state?<p>Проверяем способы входа…</p>:<div className="business-actions">{sellerProviderIds.map(provider=><button key={provider} className="d-btn" disabled={busy||!state.providers[provider]} onClick={()=>void signIn(provider)}>Войти через {sellerProviderLabel(provider)}{!state.providers[provider]?' — пока недоступен':''}</button>)}</div>}{link&&<><a className="d-btn" href={link} target="_blank" rel="noreferrer">Открыть мессенджер и подтвердить вход</a><p role="status">Подтвердите вход в боте и вернитесь сюда. Страница продолжит автоматически.</p></>}{localTest&&<details className="listing-local-demo"><summary>Локальная проверка</summary><button className="d-btn secondary" disabled={busy||!state} onClick={()=>void demoSignIn()}>Проверить локально без бота</button><p>Отдельный тестовый аккаунт. Данные остаются в локальной базе.</p></details>}{state&&!sellerProviderIds.some(p=>state.providers[p])&&<p role="status">{localTest?'Для проверки формы откройте локальный тестовый вход.':'Вход пока недоступен. Попробуйте позже.'}</p>}</section><aside className="unified-example"><div className="unified-mini-map" aria-hidden="true"><span className="map-path"/><MapPin className="map-pin-one"/><Store className="map-pin-two"/><Package className="map-pin-three"/><small>Объявления на карте</small></div><div className="unified-example-card"><div className="unified-example-picture"><Bike size={110} strokeWidth={1.5}/><span>Пример карточки</span></div><div><small>Б/у · Частный продавец</small><h2>Детский велосипед</h2><strong>5 500 ₽</strong><p><MapPin size={15}/>Место передачи рядом</p><small>Отзывы пока не собраны</small><p className="unified-example-route"><Navigation size={15}/>Маршрут к продавцу</p></div></div><p>Личные вещи и ассортимент магазина — в одном кабинете. Без отдельной заявки на подключение компании.</p></aside></div><PrimarySiteNav current="Разместить" mobile/></main>;
}
