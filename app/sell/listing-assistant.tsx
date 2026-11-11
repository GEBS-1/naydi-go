'use client';
import {useState} from 'react';
import {Sparkles,Send,Camera,Mic,Square} from 'lucide-react';
import {listingMissing,listingSteps,type ListingDraft,type ListingSuggestion} from '@/lib/listing-guide';
import {useVoiceDictation} from '../use-voice-dictation';
type Message={role:'user'|'assistant';text:string};
export default function ListingAssistant({draft,step,onApply,disabled=false,initiallyOpen=false,editing=false}:{draft:ListingDraft;step:number;initiallyOpen?:boolean;editing?:boolean;disabled?:boolean;onApply:(patch:ListingSuggestion)=>void}){
 const [mode,setMode]=useState<'choice'|'chat'|'manual'>(initiallyOpen?'chat':'choice');
 const [messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[proposal,setProposal]=useState<{patch:ListingSuggestion;baseline:string}|null>(null);
 const voice=useVoiceDictation(spoken=>setText(spoken),1500);
 const remaining=listingMissing(draft,step);
 const context={editing,name:draft.name,description:draft.description,category:draft.category,condition:draft.condition,price:draft.price,priceMode:draft.priceMode,photoCount:draft.photos.length,step,missing:remaining,hasPhone:/^\d{10,15}$/.test(draft.phone.replace(/\D/g,'')),hasCity:!!draft.city.trim(),hasAddress:!!draft.street.trim(),hasPoint:!!draft.point,sellerType:draft.sellerType||'private',companyName:draft.companyName||''};
 const baseline=JSON.stringify([draft.name,draft.description,draft.category,draft.condition,draft.price,draft.priceMode,draft.photos]);
 const stepHint=[
  editing?'Напишите, что изменить. Например: «Поставь цену 1 500 ₽» или «Сократи описание». Проверьте предложение перед применением.':'Опишите товар своими словами или загрузите фото в форме. Я предложу текст и помогу понять, какие данные ещё нужны.',
  draft.point?'Проверьте сохранённое место и контакт. Если продаёте от магазина, проверьте его название.':'Укажите телефон и выберите адрес из подсказок, чтобы отметить место на карте. Если продаёте от магазина, добавьте его название.',
  'Сверьте фото, цену, контакт и точку на карте. Когда всё верно, подтвердите данные и сами отправьте объявление на проверку.',
 ][step];
 async function photoData(){
  const response=await fetch(draft.photos[0]);if(!response.ok)throw Error('Не удалось открыть фото. Загрузите его ещё раз.');
  const bitmap=await createImageBitmap(await response.blob());try{const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Не удалось подготовить фото.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',0.8);if(data.length>1450000)throw Error('Фото слишком подробное. Выберите другое или опишите товар текстом.');return data;}finally{bitmap.close();}
 }
 async function send(message=text,withPhoto=false){if(message.trim().length<2||busy||disabled)return;setBusy(true);setError('');setProposal(null);const history=messages.slice(-6).map(m=>({...m,text:m.text.slice(0,1000)}));setMessages(m=>[...m,{role:'user',text:message}]);setText('');try{const image=withPhoto?await photoData():undefined;const r=await fetch('/api/listings/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,image,current:context,history})}),b=await r.json() as {reply?:string;suggestion?:ListingSuggestion;error?:string};if(!r.ok||!b.reply)throw Error(b.error||'Помощник не ответил. Можно продолжить в полях.');setMessages(m=>[...m,{role:'assistant',text:b.reply!}]);if(b.suggestion&&Object.keys(b.suggestion).length)setProposal({patch:b.suggestion,baseline});}catch(e){setError(e instanceof DOMException?'Не удалось прочитать фотографию. Выберите другой JPG, PNG или WebP.':(e as Error).message);}finally{setBusy(false);}}
 if(mode==='manual')return <button className="listing-assistant-open" type="button" onClick={()=>setMode('chat')}><Sparkles size={16} aria-hidden="true"/> Открыть помощника</button>;
 return <aside id="listing-assistant-panel" className="listing-assistant" aria-label="Помощник объявления">
 <div className="listing-assistant-heading"><strong><Sparkles size={18} aria-hidden="true"/> Найди-помощник</strong>{mode==='chat'&&<button className="listing-assistant-open" type="button" onClick={()=>setMode('manual')}>Свернуть чат</button>}</div>
 {mode==='choice'?<>
 <p>Здравствуйте! Помочь составить объявление? Можете заполнить форму сами или рассказать мне о товаре.</p>
 <div className="listing-assistant-actions">
 <button className="d-btn" type="button" onClick={()=>setMode('chat')}>Составить с помощником</button>
 <button className="d-btn secondary" type="button" onClick={()=>setMode('manual')}>Заполнить вручную</button>
 </div>
 </>:<>
 <p aria-live="polite"><strong>{listingSteps[step]}.</strong> {stepHint}</p>
 {step===0&&draft.photos.length>0&&<div className="listing-quick-create"><button className="d-btn secondary" type="button" disabled={busy||disabled} onClick={()=>void send(text.trim()||'Подготовь карточку товара по фото',true)}><Camera size={17}/>{busy?'Готовлю карточку…':'Создать карточку по фото'}</button><small>Использую первое фото из формы.</small></div>}
 <div className="listing-chat" role="log" aria-label="Разговор с помощником">{messages.map((m,i)=><p key={i} className={'listing-chat-'+m.role}><b>{m.role==='user'?'Вы':'Помощник'}:</b> {m.text}</p>)}</div>
 <div className="listing-help-chips">{draft.name.trim().length>=3&&<button type="button" disabled={busy||disabled} onClick={()=>void send('Как улучшить название и описание для поиска? Используй только заполненные сведения и объясни, почему вариант проще найти.')}>Улучшить для поиска</button>}<button type="button" disabled={busy||disabled} onClick={()=>void send('Что обязательно заполнить, а что можно пропустить?')}>Что обязательно?</button><button type="button" disabled={busy||disabled} onClick={()=>void send('Кто увидит адрес и телефон?')}>Кто увидит контакты?</button></div>
 <label>Сообщение помощнику<textarea maxLength={1500} value={text} onChange={e=>setText(e.target.value)} placeholder="Например: велосипед Stels, б/у, 5500 рублей. Можно добавить подсказку к фото."/></label><div className="listing-assistant-actions">{voice.phase==='recording'?<button className="d-btn secondary" type="button" onClick={()=>void voice.finish(false)}><Square size={15}/>Остановить · {Math.floor(voice.seconds/60)}:{String(voice.seconds%60).padStart(2,'0')}</button>:<button className="d-btn secondary" type="button" disabled={busy||disabled||voice.phase!=='idle'} onClick={()=>void voice.start()}><Mic size={15}/>{voice.phase==='idle'?'Продиктовать':'Распознаю…'}</button>}<button className="d-btn secondary" type="button" disabled={busy||disabled||voice.phase!=='idle'||text.trim().length<2} onClick={()=>void send()}><Send size={15}/>{busy?'Готовлю подсказку…':'Отправить помощнику'}</button></div>{voice.message&&<p role="status">{voice.message}</p>}
 {error&&<p role="alert">{error}</p>}{proposal&&<div className="listing-proposal"><b>{editing?'Предлагаю изменить':'Предлагаю заполнить'}</b>{proposal.patch.category&&<p>Категория: {proposal.patch.category}</p>}{proposal.patch.name&&<p>Название: {proposal.patch.name}</p>}{proposal.patch.description&&<p>Описание: {proposal.patch.description}</p>}{proposal.patch.condition&&<p>Состояние: {proposal.patch.condition==='used'?'Б/у':'Новый'}</p>}{proposal.patch.priceMode==='negotiable'&&<p>Цена: договорная</p>}{proposal.patch.price!==undefined&&<p>Цена: {proposal.patch.price===0?'Бесплатно':proposal.patch.price+' ₽'}</p>}{baseline!==proposal.baseline?<p>Вы уже изменили поля. Отправьте помощнику актуальное описание ещё раз.</p>:<button className="d-btn" type="button" disabled={disabled} onClick={()=>{onApply(proposal.patch);setProposal(null);}}>Применить предложение</button>}<small>Предложение не публикует объявление.</small></div>}
 </>}</aside>;
}
