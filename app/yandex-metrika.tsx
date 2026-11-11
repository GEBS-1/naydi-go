'use client';
import Script from "next/script";
import {useEffect,useState} from 'react';

const COUNTER_ID = 114124874;

export default function YandexMetrika() {
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{const update=()=>{let accepted=false;try{accepted=localStorage.getItem('ng_analytics_consent_v1')==='yes';}catch{}setEnabled(accepted&&location.hostname==='naydigo.prepromo.ru'&&!navigator.webdriver&&!new URLSearchParams(location.search).has('qa'));};update();addEventListener('ng-analytics-choice',update);return()=>removeEventListener('ng-analytics-choice',update);},[]);
  if(!enabled)return null;
  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">{`
        (function(m,e,t,r,i,k,a){
          m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}', 'ym');
        ym(${COUNTER_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
      `}</Script>
    </>
  );
}
