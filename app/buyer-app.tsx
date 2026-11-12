'use client';
import AccountShortcut from './account/account-shortcut';
import {lazy,Suspense,useEffect,useState} from 'react';
import {MapPin,Heart,Bell} from 'lucide-react';
import SearchClient from './discovery/search-client';
import PrimarySiteNav from './primary-site-nav';
import {availability,money,type Product,type Shop} from '@/lib/model';
import './design/design.css';
import './design/reference-nav.css';
import './catalog.css';
import './image-fallback.css';
import './mobile-safe-area.css';
import './discovery/nearby.css';

const SearchHistory=lazy(()=>import('./search-history'));
const ProfilePage=lazy(()=>import('./profile-page'));
const FavoritesPage=lazy(()=>import('./favorites-page'));
const CatalogApp=lazy(()=>import('./catalog-app'));
const buyerPages=new Set(['home','search','map','browse','history','my','favorites']);

export default function BuyerApp({children}:{children?:React.ReactNode}){
 const [page,setPage]=useState('home'),[id,setId]=useState('');
 useEffect(()=>{document.documentElement.dataset.naydiHydrated='true';const change=()=>{const [next,key]=location.hash.slice(1).split('/');setPage(next||'home');setId(decodeURIComponent(key||''));window.scrollTo(0,0);};change();addEventListener('hashchange',change);return()=>{delete document.documentElement.dataset.naydiHydrated;removeEventListener('hashchange',change);};},[]);
 if(!buyerPages.has(page))return <Suspense fallback={<Loading/>}><CatalogApp/></Suspense>;
 const content=page==='history'?<Suspense fallback={<Loading/>}><SearchHistory/></Suspense>:page==='favorites'?<Suspense fallback={<Loading/>}><FavoritesPage/></Suspense>:page==='my'?<Suspense fallback={<Loading/>}><ProfilePage/></Suspense>:<SearchClient page={page} id={id} card={(product,shop)=><CompactProduct product={product} shop={shop}/>}/>;
 const home=page==='home',profile=page==='my';
 const current=home?'Главная':page==='map'||page==='browse'?'Карта':profile?'Профиль':undefined;
 return <div className="design ng-app"><header className={'d-header reference-header v3-header'+(home?' reference-header-home':profile?' reference-header-profile':' reference-header-app')}>
  <a className="d-brand" href="#home"><MapPin strokeWidth={3}/><span>Найди<span>Go</span></span></a>
  <PrimarySiteNav current={current}/>
  <div className="header-tools"><div id="buyer-city-slot" className="d-city-slot"/><a className="header-fav" href="#favorites" aria-label="Избранное"><Heart size={18}/></a><a className="header-bell" href="/messages" aria-label="Уведомления"><Bell size={18}/></a><AccountShortcut/></div>
 </header><main className="d-main">{content}{home&&children}</main><PrimarySiteNav current={current} mobile/></div>;
}
function Loading(){return <div className="ng-empty"><h1>Загружаем раздел…</h1></div>}
function CompactProduct({product,shop}:{product:Product;shop:Shop}){const image=product.photos[0];return <article className="d-product horizontal"><a className="d-image" href={'#product/'+product.id}><img src={image||'/favicon.svg'} alt={image?product.name:''} className={image?'':'ng-brand-fallback'} loading="lazy" onError={event=>{const node=event.currentTarget;if(node.dataset.fallback)return;node.dataset.fallback='true';node.src='/favicon.svg';node.classList.add('ng-brand-fallback');}}/></a><div className="d-product-copy"><strong className="d-price">{money(product.price)}</strong><a className="d-product-name" href={'#product/'+product.id}>{product.name}</a><p className="d-stock unknown">{availability(product,shop)}</p><small>{shop.name} · {shop.city}</small></div></article>}
