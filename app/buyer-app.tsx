'use client';
import {lazy,Suspense,useEffect,useState} from 'react';
import {Heart,Home,Map,MapPin,Search,Settings} from 'lucide-react';
import SearchClient from './discovery/search-client';
import {availability,money,type Product,type Shop} from '@/lib/model';
import './design/design.css';
import './catalog.css';
import './image-fallback.css';
import './mobile-safe-area.css';

const PersonalPage=lazy(()=>import('./personal'));
const CatalogApp=lazy(()=>import('./catalog-app'));
const buyerPages=new Set(['home','search','map','my','favorites']);

export default function BuyerApp(){
 const [page,setPage]=useState('home'),[id,setId]=useState('');
 useEffect(()=>{document.documentElement.dataset.naydiHydrated='true';const change=()=>{const [next,key]=location.hash.slice(1).split('/');setPage(next||'home');setId(decodeURIComponent(key||''));window.scrollTo(0,0);};change();addEventListener('hashchange',change);return()=>{delete document.documentElement.dataset.naydiHydrated;removeEventListener('hashchange',change);};},[]);
 if(!buyerPages.has(page))return <Suspense fallback={<Loading/>}><CatalogApp/></Suspense>;
 const content=page==='my'||page==='favorites'?<Suspense fallback={<Loading/>}><PersonalPage favoritesOnly={page==='favorites'}/></Suspense>:<SearchClient page={page} id={id} card={(product,shop)=><CompactProduct product={product} shop={shop}/>}/>;
 return <div className="design ng-app"><header className="d-header"><a className="d-brand" href="#home"><MapPin strokeWidth={3}/><span>Найди<span>Go</span></span></a><div id="buyer-city-slot" className="d-city-slot"/><nav><a href="#search">Поиск</a><a href="#favorites">Избранное</a><a href="#my">Моё</a></nav><a className="d-business-link" href="/connect">Добавить магазин</a></header><main className="d-main">{content}</main><nav className="d-bottom">{[[Home,'home','Главная'],[Search,'search','Поиск'],[Map,'map','Карта'],[Heart,'favorites','Избранное'],[Settings,'my','Моё']].map(([Icon,key,label])=>{const I=Icon as typeof Home;return <a key={key as string} href={'#'+key} className={page===key?'active':''}><I size={21}/>{label as string}</a>})}</nav></div>;
}
function Loading(){return <div className="ng-empty"><h1>Загружаем раздел…</h1></div>}
function CompactProduct({product,shop}:{product:Product;shop:Shop}){const image=product.photos[0];return <article className="d-product horizontal"><a className="d-image" href={'#product/'+product.id}><img src={image||'/favicon.svg'} alt={image?product.name:''} className={image?'':'ng-brand-fallback'} loading="lazy" onError={event=>{const node=event.currentTarget;if(node.dataset.fallback)return;node.dataset.fallback='true';node.src='/favicon.svg';node.classList.add('ng-brand-fallback');}}/></a><div className="d-product-copy"><strong className="d-price">{money(product.price)}</strong><a className="d-product-name" href={'#product/'+product.id}>{product.name}</a><p className="d-stock unknown">{availability(product,shop)}</p><small>{shop.name} · {shop.city}</small></div></article>}
