'use client';
import {useMemo,useState} from 'react';
import {Heart,MapPin,Search,Trash2,ExternalLink,House,Map,Package,MessageCircle,Store,History,Settings,Wrench,Bell,Sparkles} from 'lucide-react';
import {usePersonal} from './personal';
import {toggleFavorite,type Favorite} from '@/lib/personal';
import './favorites-page.css';

const groups=[['product','Товары',Package],['service','Услуги',Wrench],['store','Магазины',Store]] as const;
function savedWord(count:number){const tail=count%100,last=count%10;return tail>=11&&tail<=14?'сохранений':last===1?'сохранение':last>=2&&last<=4?'сохранения':'сохранений';}
export default function FavoritesPage(){
 const {favorites}=usePersonal(),[kind,setKind]=useState<string>('product'),[query,setQuery]=useState(''),[sort,setSort]=useState('new'),[error,setError]=useState('');
 const visible=useMemo(()=>favorites.filter(item=>(kind==='all'||item.kind===kind)&&item.title.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'))).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title,'ru'):favorites.indexOf(a)-favorites.indexOf(b)),[favorites,kind,query,sort]);
 function remove(item:Favorite){try{toggleFavorite(item);setError('');}catch(e){setError((e as Error).message);}}
 function openCurrentMap(event:React.MouseEvent<HTMLAnchorElement>){try{const query=sessionStorage.getItem('ng_last_search_query');if(query){event.preventDefault();location.hash='map/'+encodeURIComponent(query);}}catch{/* use the published listings map */}}
 return <div className="favorites-layout">
  <nav className="favorites-sidebar" aria-label="Разделы НайдиGo">
   <a href="#home"><House size={20}/>Главная</a>
   <a href="#home"><Search size={20}/>Поиск</a>
   <a href="#browse" onClick={openCurrentMap}><Map size={20}/>Карта</a>
   <a href="#favorites" aria-current="page"><Heart size={20}/>Избранное</a>
   <a href="/sell#my-listings"><Package size={20}/>Мои объявления</a>
   <a href="/messages"><MessageCircle size={20}/>Сообщения</a>
   <a href="/connect"><Store size={20}/>Магазин (бизнес)</a>
   <a href="#history"><History size={20}/>История поиска</a>
   <a href="/messages"><Bell size={20}/>Уведомления</a>
   <a href="/account"><Settings size={20}/>Настройки</a>
   <button className="favorites-assistant" type="button" onClick={()=>window.dispatchEvent(new Event('ng-open-site-helper'))}><Sparkles size={18}/>AI-помощник НайдиGo<small>Помогу найти товар, разместить объявление или подключить магазин.</small><b>Открыть чат</b></button>
  </nav>
  <section className="favorites-screen" aria-labelledby="favorites-title"><header><Heart size={36} aria-hidden="true"/><div><h1 id="favorites-title">Избранное <small>{favorites.length} {savedWord(favorites.length)}</small></h1><p>Товары, услуги и магазины, к которым можно вернуться. Цена и наличие могли измениться.</p></div></header>
  <div className="favorites-controls"><div className="favorites-tabs" role="group" aria-label="Тип сохранений">{groups.map(([value,label,Icon])=><button type="button" key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}><Icon size={16} aria-hidden="true"/>{label}<small>{favorites.filter(f=>f.kind===value).length}</small></button>)}</div><label className="favorites-query"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск в избранном..." aria-label="Поиск в избранном"/></label><label className="favorites-sort"><span className="sr-only">Сортировка</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="new">Сначала новые</option><option value="name">По названию</option></select></label></div>
  {error&&<p role="alert">{error}</p>}{!visible.length&&<div className="favorites-empty"><Heart size={34}/><h2>{favorites.length?'Ничего не найдено':'Пока ничего не сохранено'}</h2><p>Нажмите сердечко на карточке результата, чтобы вернуться к нему позже.</p><a href="#home">Перейти к поиску</a></div>}
  <div className="favorites-grid">{visible.map(item=><article key={item.id} className="favorites-card"><div className="favorites-image">{item.image?<img src={item.image} alt={item.title} loading="lazy" onError={e=>{e.currentTarget.src='/favicon.svg';e.currentTarget.classList.add('favorites-fallback');}}/>:<img src="/favicon.svg" className="favorites-fallback" alt="Фото не опубликовано"/>}</div><div className="favorites-copy"><small className="favorites-kind">{item.kind==='product'?'Товар':item.kind==='store'?'Магазин':item.kind==='service'?'Услуга':'Ссылка'}</small><h2>{item.title}</h2>{item.price!=null&&<strong>{item.price.toLocaleString('ru-RU')} ₽ <small>при сохранении</small></strong>}<p><MapPin size={15}/>{item.address||item.city}</p><div className="favorites-actions"><a href={item.url} target={item.url.startsWith('http')?'_blank':undefined} rel="noreferrer">Открыть <ExternalLink size={15}/></a>{item.destination&&<a href={'https://yandex.ru/maps/?'+new URLSearchParams({rtext:'~'+item.destination.lat+','+item.destination.lng,rtt:'auto'})} target="_blank" rel="noopener noreferrer"><MapPin size={15}/>Маршрут</a>}<button type="button" onClick={()=>remove(item)} aria-label={'Убрать из избранного: '+item.title}><Trash2 size={15}/>Удалить</button></div></div></article>)}</div>
 </section></div>;
}
