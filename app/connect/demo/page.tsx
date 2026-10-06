import type {Metadata} from 'next';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import DemoStorePreview from '../demo-store';
import '../../design/design.css';
import '../connect.css';

export const metadata:Metadata={title:'Демо-магазин — НайдиGo',description:'Пример страницы магазина и каталога в локальном поиске НайдиGo.'};
export default function DemoStorePage(){return <div className="connect-demo-page"><header className="connect-header"><a className="connect-brand" href="/"><span className="connect-pin">●</span>Найди<span>Go</span></a><nav><a href="/connect"><ArrowLeft size={16}/>Для бизнеса</a></nav><a className="connect-header-cta" href="/business-demo">Создать свой магазин</a></header><main><div className="connect-demo-title"><p className="connect-kicker">ПРИМЕР ВИТРИНЫ</p><h1>Так магазин выглядит для покупателя</h1><p>Покупатель видит контакты, адрес, каталог, цены и честный статус наличия. После модерации реальные товары также участвуют в общем поиске НайдиGo.</p></div><DemoStorePreview/><section className="connect-bottom-cta"><div><h2>Хотите такую страницу для своего магазина?</h2><p>Создайте черновик, добавьте несколько товаров и посмотрите результат до публикации.</p></div><a className="connect-primary" href="/business-demo">Создать магазин бесплатно<ArrowRight/></a></section></main></div>}
