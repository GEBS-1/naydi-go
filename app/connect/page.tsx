import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowRight,BarChart3,Check,Search,Store} from 'lucide-react';
import ApplicationForm from './application-form';
import DemoStorePreview from './demo-store';
import '../design/design.css';
import './connect.css';

export const metadata:Metadata={title:'Для бизнеса — разместить товары в НайдиGo',description:'Добавьте ассортимент магазина в локальный поиск НайдиGo: вручную, с сайта, по фотографии или из Excel.'};
const benefits=[{icon:<Search/>,title:'Покупатели рядом с вами',text:'Люди ищут конкретные товары в своём городе и видят подходящие предложения.'},{icon:<BarChart3/>,title:'Простое подключение',text:'Сайт, Excel, фотография или ручное добавление — используйте удобный способ.'},{icon:<Store/>,title:'Витрина + общий поиск',text:'Товары видны на странице магазина и участвуют в поиске НайдиGo.'}];

export default function ConnectPage(){return <div className="connect-page">
 <header className="connect-header"><Link className="connect-brand" href="/"><span className="connect-pin">●</span>Найди<span>Go</span></Link><nav aria-label="Основная навигация"><Link href="/">Покупателям</Link><span className="active">Для бизнеса</span><Link href="/#search">Поиск</Link></nav><Link className="connect-header-cta" href="/business-demo">Разместить магазин</Link></header>
 <main><section className="connect-hero"><div className="connect-hero-copy"><p className="connect-kicker"><Store size={15}/>НАЙДИGO ДЛЯ БИЗНЕСА</p><h1>Разместите товары<br/>в локальном поиске</h1><p className="connect-lead">Покупатели в вашем городе ищут конкретные товары. Добавьте ассортимент — ваши предложения смогут появляться в НайдиGo.</p><div className="connect-benefits">{benefits.map(item=><article key={item.title}><span>{item.icon}</span><div><b>{item.title}</b><p>{item.text}</p></div></article>)}</div><div className="connect-actions"><Link className="connect-primary" href="/business-demo">Создать магазин бесплатно<ArrowRight size={18}/></Link><Link className="connect-secondary" href="/connect/demo">Посмотреть демо-магазин</Link><ApplicationForm triggerClass="connect-tertiary"/></div><p className="connect-fine">Подключаем первые магазины и помогаем подготовить каталог. Публикация — только после проверки.</p></div><div className="connect-hero-preview"><DemoStorePreview compact/><span className="connect-preview-note">Так покупатель увидит ваш магазин</span></div></section>
 <section className="connect-how"><div><p className="connect-kicker">КАК ЭТО РАБОТАЕТ</p><h2>От данных магазина до покупателей — три шага</h2></div><div className="connect-how-grid">{[['01','Магазин','Название, город, адрес и контакты. Остальное можно заполнить позже.'],['02','Товары','Добавьте ассортимент с сайта, из Excel, по фото или вручную.'],['03','Проверка','Посмотрите витрину глазами покупателя и отправьте на подключение.']].map(([n,title,text])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p><div><Check size={16}/>Черновик сохраняется</div></article>)}</div></section>
 <section className="connect-bottom-cta"><div><p className="connect-kicker">МОЖНО НАЧАТЬ БЕЗ КАТАЛОГА</p><h2>Не хотите заполнять всё самостоятельно?</h2><p>Оставьте контакты. Мы посмотрим сайт магазина и свяжемся с вами по удобному каналу.</p></div><ApplicationForm triggerClass="connect-primary" label="Оставить заявку"/></section></main>
 <footer className="connect-footer"><Link className="connect-brand" href="/">Найди<span>Go</span></Link><p>Витрина + каталог + попадание товаров в общий поиск НайдиGo.</p></footer>
 </div>}
