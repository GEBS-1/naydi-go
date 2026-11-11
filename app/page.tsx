import BuyerApp from './buyer-app';
import type { Metadata } from 'next';

const title = 'НайдиGo — поиск товаров и магазинов рядом';
const description = 'НайдиGo ищет товары по открытым источникам и витринам магазинов, показывает адреса на карте. Размещайте объявления о своих торговых точках и услугах.';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://naydigo.prepromo.ru/' },
  openGraph: { title, description, url: 'https://naydigo.prepromo.ru/', locale: 'ru_RU', type: 'website' },
};

export default function Page() {
  return (
    <BuyerApp>
      <footer className="naydigo-home-footer"><a href="/about">О НайдиGO</a></footer>
    </BuyerApp>
  );
}
