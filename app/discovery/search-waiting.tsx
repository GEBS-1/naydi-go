'use client';
// No campaign is configured: no ad requests, impressions or artificial delay.
type Campaign={label:string;url:string;advertiser:string;erid:string};
const campaign:Campaign|null=null;
export default function SearchWaiting({localReady}:{localReady:boolean}){const ad=campaign as Campaign|null;return <section className="finder-waiting" aria-label="Поиск выполняется"><p role="status">{localReady?'Проверяем внешние источники. Найденное в индексе уже доступно.':'Ищем предложения в индексе…'}</p>{ad?<aside aria-label="Реклама"><small>Реклама · {ad.advertiser} · erid: {ad.erid}</small><a href={ad.url} target="_blank" rel="noreferrer sponsored">{ad.label}</a></aside>:<p className="finder-waiting-neutral">Результаты появятся по мере готовности</p>}</section>}
