'use client';

import {Search,X} from 'lucide-react';

const steps=[
 {title:'Скажите, что ищете',text:'Введите товар, услугу или магазин. Можно выбрать пример и поменять слова.'},
 {title:'Укажите, где искать',text:'Выберите город, адрес или разрешите браузеру определить вашу точку.'},
 {title:'Посмотрите предложения на карте',text:'Кнопка «Открыть карту» покажет опубликованные объявления. В результатах поиска маршрут доступен у предложений с подтверждённым адресом.'},
];

export default function SearchGuide({step,onChange}:{step:number|null;onChange:(step:number|null)=>void}){
 return <div className="home-guide">
  <button type="button" className="home-guide-toggle" aria-expanded={step!==null} aria-controls="home-guide-panel" onClick={()=>onChange(step===null?0:null)}><Search size={17} aria-hidden="true"/> Подсказать?</button>
  {step!==null&&<section className="home-guide-panel" id="home-guide-panel" aria-label="Подсказки по поиску">
   <button type="button" className="home-guide-close" aria-label="Закрыть подсказку" onClick={()=>onChange(null)}><X size={17}/></button>
   <div aria-live="polite"><small>Шаг {step+1} из {steps.length}</small><h3>{steps[step].title}</h3><p>{steps[step].text}</p></div>
   <div className="home-guide-actions">
    {step>0&&<button type="button" onClick={()=>onChange(step-1)}>Назад</button>}
    <button type="button" className="finder-primary" onClick={()=>onChange(step+1<steps.length?step+1:null)}>{step+1<steps.length?'Дальше':'Готово'}</button>
   </div>
  </section>}
 </div>;
}
