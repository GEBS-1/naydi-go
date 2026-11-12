import type { Metadata } from "next";
import YandexMetrika from "./yandex-metrika";
import VisitTracker from './visit-tracker';
import LegalConsent from './legal-consent';
import PersonalAccountSync from './personal-account-sync';
import SiteHelper from './site-helper';
import "./globals.css";
import './launch-polish.css';
import './legal-consent.css';

export const metadata: Metadata = {
  title: "НайдиGo — товары рядом",
  description: "Поиск товаров и офлайн-магазинов по России: предложения, опубликованные цены, источники и маршруты.",
  metadataBase: new URL('https://naydigo.prepromo.ru'),
  openGraph: {title:'НайдиGo — товары и магазины вашего города',description:'Найдите предложение, сравните цены и постройте маршрут.',locale:'ru_RU',type:'website'},
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><YandexMetrika /><VisitTracker /><PersonalAccountSync />{children}<SiteHelper/><LegalConsent /></body></html>;
}
