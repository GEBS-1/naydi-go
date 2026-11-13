'use client';
import {useEffect,useState} from 'react';
import {Bookmark,Clock,RotateCcw,Trash2} from 'lucide-react';
import {readPersonal,emptyPersonal,updatePersonal,replaySearch,personalEvent,type SavedSearch} from '@/lib/personal';

export default function SearchHistory({compact=false}:{compact?:boolean}){
 const [data,setData]=useState(emptyPersonal),[error,setError]=useState('');
 useEffect(()=>{const refresh=()=>setData(readPersonal());refresh();addEventListener(personalEvent,refresh);addEventListener('storage',refresh);return()=>{removeEventListener(personalEvent,refresh);removeEventListener('storage',refresh);};},[]);
 const unique=new Map<string,SavedSearch>();for(const s of [...data.history,...data.searches].sort((a,b)=>b.at-a.at)){const key=s.query.toLocaleLowerCase('ru')+'|'+s.city;if(!unique.has(key))unique.set(key,s);}const rows=[...unique.values()];
 function saved(s:SavedSearch){return data.searches.some(x=>x.query===s.query&&x.city===s.city);}
 function save(s:SavedSearch){try{if(saved(s))updatePersonal(p=>({...p,searches:p.searches.filter(x=>x.query!==s.query||x.city!==s.city)}));else updatePersonal(p=>({...p,searches:[s,...p.searches.filter(x=>x.query!==s.query||x.city!==s.city)].slice(0,100)}));}catch(e){setError((e as Error).message);}}
 function remove(s:SavedSearch){try{updatePersonal(p=>({...p,history:p.history.filter(x=>x.query!==s.query||x.city!==s.city),searches:p.searches.filter(x=>x.query!==s.query||x.city!==s.city)}));}catch(e){setError((e as Error).message);}}
 if(compact&&!rows.length)return null;
 return <section className={'search-history '+(compact?'history-preview':'')}>
  {compact?<div className="history-heading"><h2>Недавно искали вы</h2><a href="#my/history">Вся история</a></div>:<><h1>История поиска</h1><p className="history-note">Сохранено в этом браузере. При повторе обновим предложения от вашей текущей точки.</p></>}
  {error&&<p role="alert">{error}</p>}
  {!rows.length&&<p className="history-empty">Здесь появятся ваши поиски с датой и временем.</p>}
  <div className="history-grid">{rows.slice(0,compact?3:100).map(s=><article className="history-card" data-search-key={s.searchKey} key={s.query+'|'+s.city}>
   <div className="history-card-top">{saved(s)?<Bookmark size={17}/>:<Clock size={17}/>}<time dateTime={new Date(s.at).toISOString()}>{new Date(s.at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time><button type="button" aria-label={(saved(s)?'Убрать из сохранённых: ':'Сохранить поиск: ')+s.query} aria-pressed={saved(s)} onClick={()=>save(s)}><Bookmark size={16} fill={saved(s)?'currentColor':'none'}/></button></div>
   <h3>{s.query}</h3><p>{s.city}</p><div className="history-card-actions"><button type="button" onClick={()=>replaySearch(s)}><RotateCcw size={14}/>Повторить поиск</button>{!compact&&<button type="button" aria-label={'Удалить поиск: '+s.query} onClick={()=>remove(s)}><Trash2 size={14}/></button>}</div>
  </article>)}</div>
 </section>;
}
