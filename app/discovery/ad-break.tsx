'use client';
import {useEffect,useRef,useState} from 'react';

const SECONDS=8;

export default function AdBreak({onDone,onCancel}:{onDone:()=>void;onCancel:()=>void}){
  const [left,setLeft]=useState(SECONDS);
  const done=useRef(onDone);
  const finished=useRef(false);
  useEffect(()=>{done.current=onDone;},[onDone]);
  useEffect(()=>{
    const started=performance.now();
    const id=window.setInterval(()=>{
      const remain=Math.max(0,SECONDS-Math.floor((performance.now()-started)/1000));
      setLeft(remain);
      if(remain===0&&!finished.current){finished.current=true;window.clearInterval(id);done.current();}
    },200);
    return()=>window.clearInterval(id);
  },[]);
  return <div className="finder-ad" role="dialog" aria-modal="true" aria-labelledby="finder-ad-title">
    <div className="finder-ad-card">
      <p className="finder-kicker">БЕСПЛАТНЫЙ ТАРИФ</p>
      <h2 id="finder-ad-title">Короткая реклама</h2>
      <p>Поиск начнётся через {left} с. На бесплатном тарифе перед запросом идёт показ около 5–10 секунд: так поиск не нужно сразу делать платным.</p>
      <div className="finder-ad-slot" aria-label="Рекламное место"><span>Реклама</span><b>Место для объявления</b></div>
      <button type="button" onClick={onCancel}>Отмена</button>
    </div>
  </div>;
}
