'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Search,Mic,ArrowRight,X,Square,ArrowUp} from 'lucide-react';

type Piece={isFinal:boolean;0:{transcript:string}};
type Recognition={
  lang:string;continuous:boolean;interimResults:boolean;
  onresult:((e:{results:ArrayLike<Piece>})=>void)|null;
  onerror:((e:{error:string})=>void)|null;
  onend:(()=>void)|null;
  start:()=>void;stop:()=>void;abort:()=>void;
};
type Intent='idle'|'listen'|'cancel'|'stop'|'send'|'error';

export default function VoiceSearch({value,onChange,onSearch,busy=false,cityControl}:{cityControl?:ReactNode;value:string;onChange:(s:string)=>void;onSearch:(text?:string)=>void;busy?:boolean}){
  const rec=useRef<Recognition|null>(null);
  const field=useRef<HTMLTextAreaElement|null>(null);
  const intent=useRef<Intent>('idle');
  const original=useRef('');
  const before=useRef('');
  const latest=useRef(value);
  const sent=useRef(false);
  const restartTimer=useRef<number|null>(null);
  const [listening,setListening]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{latest.current=value;},[value]);
  useEffect(()=>{const el=field.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,176)+'px';el.style.overflowY=el.scrollHeight>176?'auto':'hidden';},[value]);
  useEffect(()=>()=>{if(restartTimer.current!==null)window.clearTimeout(restartTimer.current);const current=rec.current;rec.current=null;intent.current='cancel';if(current){current.onresult=null;current.onerror=null;current.onend=null;current.abort();}},[]);

  function applyTranscript(results:ArrayLike<Piece>){
    let finalText='',interim='';
    for(let i=0;i<results.length;i++){const piece=results[i][0]?.transcript||'';if(results[i].isFinal)finalText+=piece+' ';else interim+=piece+' ';}
    const spoken=(finalText+interim).replace(/\s+/g,' ').trim();
    const base=before.current.trim();
    const next=[base,spoken].filter(Boolean).join(' ').slice(0,500);
    latest.current=next;
    onChange(next);
  }
  function deliver(text:string){
    if(sent.current)return;
    sent.current=true;
    if(text)onSearch(text);
  }
  function openSession(Constructor:new()=>Recognition,restarting=false){
    if(restarting)before.current=latest.current;
    const session=new Constructor();
    rec.current=session;
    session.lang='ru-RU';
    session.continuous=true;
    session.interimResults=true;
    session.onresult=e=>{if(rec.current===session&&intent.current!=='cancel')applyTranscript(e.results);};
    session.onerror=e=>{
      if(e.error==='aborted'||intent.current==='cancel'||(intent.current==='listen'&&e.error==='no-speech'))return;
      intent.current='error';
      setMessage(e.error==='not-allowed'?'Нет доступа к микрофону. Можно ввести запрос вручную.':'Распознавание прервано. Проверьте текст или повторите диктовку.');
    };
    session.onend=()=>{
      if(rec.current!==session)return;
      rec.current=null;
      const why=intent.current;
      if(why==='listen'){
        // Chrome may close a continuous recognition session after silence.
        // Keep dictation active and reconnect until the user explicitly acts.
        setMessage('Слушаю. Пауза не завершает диктовку.');
        restartTimer.current=window.setTimeout(()=>{restartTimer.current=null;if(intent.current==='listen')openSession(Constructor,true);},250);
        return;
      }
      intent.current='idle';
      setListening(false);
      if(why==='error')return;
      if(why==='cancel'){latest.current=before.current;onChange(before.current);setMessage('');return;}
      const text=latest.current.trim().slice(0,500);
      onChange(text);
      if(why==='send'){setMessage('');deliver(text);return;}
      setMessage(text?'Диктовка остановлена. Текст можно проверить и отправить.':'Речь не распознана. Повторите или введите запрос.');
    };
    try{session.start();setListening(true);setMessage('Диктовка идёт. Остановите или отправьте её кнопкой.');}catch{
      rec.current=null;
      if(intent.current==='listen'&&restarting){restartTimer.current=window.setTimeout(()=>openSession(Constructor,true),600);return;}
      intent.current='idle';setListening(false);setMessage('Голосовой ввод недоступен. Используйте клавиатуру.');
    }
  }
  function start(){
    const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
    const Constructor=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!Constructor){setMessage('В этом браузере голосовой ввод недоступен. Введите запрос с клавиатуры.');return;}
    before.current=value;
    original.current=value;
    latest.current=value;
    sent.current=false;
    intent.current='listen';
    openSession(Constructor);
  }
  function cancel(){
    if(restartTimer.current!==null){window.clearTimeout(restartTimer.current);restartTimer.current=null;}
    intent.current='cancel';
    latest.current=original.current;
    onChange(original.current);
    setMessage('');
    setListening(false);
    const session=rec.current;rec.current=null;
    try{session?.abort();}catch{/* already stopped */}
  }
  function stop(){if(restartTimer.current!==null){window.clearTimeout(restartTimer.current);restartTimer.current=null;}intent.current='stop';const session=rec.current;if(!session){setListening(false);setMessage('Диктовка остановлена. Текст можно проверить и отправить.');return;}try{session.stop();}catch{setListening(false);}}
  function sendNow(){
    if(restartTimer.current!==null){window.clearTimeout(restartTimer.current);restartTimer.current=null;}
    intent.current='send';
    const session=rec.current;
    if(!session){setListening(false);deliver(latest.current.trim());return;}
    try{session.stop();}catch{setListening(false);deliver(latest.current.trim());}
  }

  return <>
    <form className={'finder-search'+(listening?' dictating':'')} onSubmit={e=>{e.preventDefault();if(listening)sendNow();else onSearch(value);}}>
      <Search size={23}/>
      {cityControl}
      <textarea ref={field} rows={1} aria-label="Что хотите найти?" readOnly={listening} placeholder={listening?'Говорите…':'Товар, услуга или магазин…'} maxLength={500} value={value} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(listening)sendNow();else onSearch(value);}}} onChange={e=>{latest.current=e.target.value;onChange(e.target.value);}}/>
      {listening?<div className="finder-dictate" role="group" aria-label="Диктовка">
        <span className="finder-dictate-live" aria-hidden="true"><i/><i/><i/>Слушаю</span>
        <button type="button" aria-label="Отменить диктовку" title="Отменить диктовку" onClick={cancel}><X size={18}/></button>
        <button type="button" aria-label="Остановить диктовку" title="Остановить диктовку" onClick={stop}><Square size={16}/></button>
        <button type="button" className="finder-primary finder-dictate-send" aria-label="Отправить сразу" title="Отправить сразу" onClick={sendNow}><ArrowUp size={18}/></button>
      </div>:<><button type="button" className="finder-mic" aria-label="Голосовой ввод" onClick={start}><Mic size={22}/></button><button className="finder-primary" disabled={busy}>{busy?'Ищем…':'Найти'}<ArrowRight size={19}/></button></>}
    </form>
    {message&&<p className="finder-voice-status" role="status">{message}</p>}
    {listening&&<p className="finder-voice-status">Браузер может передавать голос своему сервису распознавания. НайдиGo не сохраняет аудио.</p>}
  </>;
}
