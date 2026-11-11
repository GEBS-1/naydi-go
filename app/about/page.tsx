import type {Metadata} from 'next';
import '../design/design.css';
import '../catalog.css';
import './about.css';

const title='Что такое НайдиGO и как работает поиск рядом';
const description='НайдиGO помогает найти товары и услуги рядом, увидеть точку на карте, построить маршрут и связаться с продавцом. Как пользоваться поиском и разместить объявление.';

export const metadata:Metadata={title,description,alternates:{canonical:'https://naydigo.prepromo.ru/about'},openGraph:{title,description,url:'https://naydigo.prepromo.ru/about',locale:'ru_RU',type:'website'}};

const steps=[
 {title:'Введите запрос',text:'Напишите, что вам нужно, и выберите город или точку. НайдиGO проверяет объявления пользователей, доступные страницы продавцов и открытые данные о местных организациях.'},
 {title:'Сравните предложения',text:'Откройте карточку и посмотрите фото, цену и адрес, если они есть в источнике. Иногда в выдаче есть подходящие магазины, где стоит уточнить наличие товара.'},
 {title:'Постройте маршрут',text:'Откройте карту и выберите точку с подтверждённым адресом. Перед поездкой уточните наличие и условия у продавца. О покупке вы договариваетесь напрямую.'},
];

export default function AboutPage(){
 return <div className="design ng-app"><header className="d-header"><a className="d-brand" href="/"><span>Найди<span>GO</span></span></a><nav><a href="/">Найти рядом</a><a href="/#browse">Карта объявлений</a></nav></header>
  <main className="d-main">
   <article className="about-search">
    <header className="about-hero"><p>О НАЙДИGO</p><h1>Что такое НайдиGO и как работает поиск рядом</h1><p>Найдите товар, услугу или магазин рядом с вами, посмотрите адрес и постройте маршрут.</p><a href="/">Попробовать поиск</a></header>
    <section aria-labelledby="about-steps"><h2 id="about-steps">От запроса до маршрута</h2><ol>{steps.map((step,index)=><li key={step.title}><span aria-hidden="true">{index+1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol></section>
    <section id="video" aria-labelledby="about-video-title"><h2 id="about-video-title">Как пользоваться НайдиGO</h2><p>Короткое видео о поиске товара, карте и маршруте.</p><video controls preload="metadata" playsInline poster="/tutorial/naydigo.jpg" aria-label="Видео о поиске в НайдиGO">
     <source src="/tutorial/naydigo.mp4" type="video/mp4"/>
     <track kind="captions" src="/tutorial/naydigo.vtt" srcLang="ru" label="Русский" default/>
    </video></section>
    <section className="about-more" aria-label="Другие возможности">
     <div><h2>Посмотрите, что продают в городе</h2><p>На отдельной карте собраны опубликованные объявления людей и магазинов НайдиGO. Можно открыть её без запроса.</p><a href="/#browse">Открыть карту</a></div>
     <div><h2>Найдите что-нибудь по дороге</h2><p>Напишите «Еду до вокзала, по дороге найди свежую капусту». Подтвердите точки маршрута, чтобы посмотреть подходящие места для заезда.</p></div>
     <div><h2>Разместите свой товар</h2><p>Войдите через Telegram или MAX, добавьте фото и укажите место передачи. После проверки объявление появится в поиске и на карте.</p><a href="/sell">Разместить объявление</a></div>
    </section>
   </article>
  </main>
 </div>;
}
