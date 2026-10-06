import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import DemoStorePreview from '../demo-store';
import '../../design/design.css';
import '../connect.css';

export const metadata:Metadata={title:'Демо-магазин — НайдиGo',description:'Пример страницы магазина и каталога в локальном поиске НайдиGo.'};
export default function DemoStorePage(){return <div className="connect-demo-page"><header className="connect-header"><Link className="connect-brand" href="/"><span className="connect-pin">●</span>Найди<span>Go</span></Link><nav><Link href="/connect"><ArrowLeft size={16}/>Для бизнеса</Link></nav><Link className="connect-header-cta" href="/business-demo">Создать свой магазин</Link></header><main><div className="connect-demo-title"><p className="connect-kicker">ПРИМЕР ВИТРИНЫ</p><h1>Так магазин выглядит для покупателя</h1><p>Покупатель видит контакты, адрес, каталог, цены и честный статус наличия. После модерации реальные товары также участвуют в общем поиске НайдиGo.</p></div><DemoStorePreview/><section className="connect-bottom-cta"><div><h2>Хотите такую страницу для своего магазина?</h2><p>Создайте черновик, добавьте несколько товаров и посмотрите результат до публикации.</p></div><Link className="connect-primary" href="/business-demo">Создать магазин бесплатно<ArrowRight/></Link></section></main></div>}
