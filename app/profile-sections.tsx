'use client';
import {useEffect,useState} from 'react';
import {Bell,History,Package,Settings,UserRound} from 'lucide-react';
import {money,type Product,type Shop} from '@/lib/model';
import DisplayName from './account/display-name';
import ProfileNotifications from './profile-notifications';
import SearchHistory from './search-history';
import './profile-page.css';

type Section='overview'|'listings'|'history'|'notifications'|'settings';
const valid=new Set<Section>(['overview','listings','history','notifications','settings']);
export default function ProfileSections({section:requested='overview'}:{section?:string}){
 const section:Section=valid.has(requested as Section)?requested as Section:'overview';
 const [name,setName]=useState<string|null>(null),[ready,setReady]=useState(false);
 const [products,setProducts]=useState<Product[]>([]),[stores,setStores]=useState<Shop[]>([]),[catalogReady,setCatalogReady]=useState(false);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all');
 useEffect(()=>{const controller=new AbortController();void fetch('/api/buyer/me?summary=1',{signal:controller.signal}).then(async r=>await r.json() as {user?:{name:string}|null}).then(data=>setName(data.user?.name||null)).catch(()=>{}).finally(()=>setReady(true));return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/catalog',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Каталог недоступен');return await r.json() as {products:Product[];stores:Shop[];owned:string[]};}).then(data=>{const ids=new Set(data.owned);setProducts(data.products.filter(p=>ids.has(p.storeId)));setStores(data.stores.filter(s=>ids.has(s.id)));}).catch(()=>{}).finally(()=>setCatalogReady(true));return()=>controller.abort();},[]);
 const isPublic=(p:Product)=>p.published&&!p.demo&&stores.some(s=>s.id===p.storeId&&s.visibility==='public');
 const isService=(p:Product)=>/услуг/i.test(p.category||'');
 const isInactive=(p:Product)=>!p.published||p.quantity===0;
 const isPending=(p:Product)=>p.published&&!isPublic(p)&&p.quantity!==0;
 const tabs=[['all','Все',products.length],['product','Товары',products.filter(p=>!isService(p)).length],['service','Услуги',products.filter(isService).length],['inactive','Неактивные',products.filter(isInactive).length],['moderation','На модерации',products.filter(isPending).length]] as const;
 const filtered=products.filter(p=>p.name.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'))&&(status==='all'||status==='product'&&!isService(p)||status==='service'&&isService(p)||status==='inactive'&&isInactive(p)||status==='moderation'&&isPending(p)));
 const nav=[['overview','Мой профиль',UserRound],['listings','Мои объявления',Package],['history','История поиска',History],['notifications','Уведомления',Bell],['settings','Настройки',Settings]] as const;
 return <div className="profile-layout"><nav className="profile-sidebar" aria-label="Разделы профиля">{nav.map(([key,label,Icon])=><a key={key} className={section===key?'active':undefined} aria-current={section===key?'page':undefined} href={key==='overview'?'#my':'#my/'+key}><Icon size={19}/>{label}{key==='listings'&&<small>{products.length}</small>}</a>)}</nav><div className="profile-content">
 <header className="profile-summary"><div className="profile-avatar" aria-hidden="true"><UserRound size={34}/></div><div><small>{name?'Ваш аккаунт':'Поиск доступен без входа'}</small><h1>{ready?name||'Гость':'Загружаем профиль…'}</h1><p>{stores[0]?.city?stores[0].city+' · ':''}{name?'Управляйте объявлениями в разделах профиля.':'Войдите, чтобы управлять объявлениями и сообщениями.'}</p></div><a href="/account">{name?'Способы входа':'Войти'}</a></header>
 {section==='overview'&&<div className="profile-shortcuts"><a href="#my/listings"><Package size={23}/>{products.length} объявлений</a><a href="#my/history"><History size={23}/>История поиска</a><a href="#my/notifications"><Bell size={23}/>Уведомления</a><a href="#my/settings"><Settings size={23}/>Настройки</a></div>}
 {section==='listings'&&<section className="profile-listings"><header><div><h2>Мои объявления</h2><p>Посмотрите статусы карточек или перейдите к редактированию.</p></div><a href="/sell">Добавить объявление</a></header><div className="profile-listing-controls"><div className="profile-tabs" role="group" aria-label="Фильтр объявлений">{tabs.map(([value,label,count])=><button type="button" key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{label} <small>({count})</small></button>)}</div><input aria-label="Поиск по моим объявлениям" placeholder="Поиск по моим объявлениям" value={query} onChange={e=>setQuery(e.target.value)}/></div>{!catalogReady?<p>Загружаем объявления…</p>:!products.length?<p className="profile-no-listings">Объявлений пока нет. Первую карточку можно создать по кнопке выше.</p>:<div className="profile-product-list">{!filtered.length&&<p role="status">По этим условиям объявлений нет.</p>}{filtered.map(p=>{const store=stores.find(s=>s.id===p.storeId);return <article key={p.id}><div className="profile-product-image"><img src={p.photos[0]||'/favicon.svg'} alt={p.photos.length?p.name:'Фото не опубликовано'} loading="lazy" onError={e=>{e.currentTarget.src='/favicon.svg';}}/></div><div><h3>{p.name}</h3><strong>{money(p.price)}</strong><p>{store?.name||'Продавец'}{store?.city?' · '+store.city:''}</p></div><span className={isPublic(p)?'published':'draft'}>{isPublic(p)?'В поиске':'Не опубликован'}</span><a href={'/sell?edit='+encodeURIComponent(p.id)}>Редактировать</a></article>})}</div>}</section>}
 {section==='history'&&<div className="profile-history"><SearchHistory/></div>}
 {section==='notifications'&&<ProfileNotifications products={products} stores={stores}/>}
 {section==='settings'&&<section className="profile-settings"><h2>Настройки профиля</h2>{name?<DisplayName name={name} onSaved={value=>{setName(value);window.dispatchEvent(new Event('ng:profile-updated'));}}/>:<p>Войдите, чтобы изменить имя и способы входа.</p>}<a href="/account">Способы входа и данные аккаунта</a></section>}
 </div></div>;
}
