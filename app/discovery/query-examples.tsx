'use client';

import {useState} from 'react';
import {ArrowRight,Camera,MapPin,Navigation,Route,Store,Wrench} from 'lucide-react';

const sets=[
 [
  {query:'Найди недорогой компактный видеорегистратор в магазинах',result:'Предложения с фото, ценой и адресом, если они указаны',icon:Camera},
  {query:'Найди диагностику автомобиля рядом',result:'Адреса сервисов поблизости и маршрут',icon:Wrench},
  {query:'Еду до вокзала, по дороге найди свежую капусту',result:'Подходящие точки по пути, где можно сделать заезд',icon:Route},
  {query:'Построй маршрут до вокзала',result:'Выбор вокзала и маршрут от вашей точки',icon:Navigation},
 ],
 [
  {query:'Где купить набор гаечных ключей?',result:'Товары и магазины, где можно уточнить наличие',icon:Store},
  {query:'Найди, где распечатать фотографии рядом',result:'Ближайшие фотосалоны с адресами',icon:Camera},
  {query:'Покажи магазины тканей рядом',result:'Магазины на карте и маршруты до них',icon:MapPin},
  {query:'Еду до парка, по дороге найди пекарню',result:'Пекарни вдоль выбранного маршрута',icon:Route},
 ],
];

export default function QueryExamples({onChoose}:{onChoose:(query:string)=>void}){
 const [group,setGroup]=useState(0);
 return <section className="home-examples" aria-labelledby="quick-search-title">
  <div className="home-section-heading">
   <h2 id="quick-search-title">Как можно спросить</h2>
   <button className="home-examples-next" type="button" onClick={()=>setGroup(n=>(n+1)%sets.length)}>Другие примеры <ArrowRight size={15} aria-hidden="true"/></button>
  </div>
  <p>Выберите пример и измените его под себя.</p>
  <div className="home-example-grid" aria-live="polite">
   {sets[group].map(({query,result,icon:Icon})=><button type="button" className="home-example" key={query} onClick={()=>onChoose(query)}>
    <Icon size={19} aria-hidden="true"/><span><strong>{query}</strong><small>{result}</small></span>
   </button>)}
  </div>
 </section>;
}
