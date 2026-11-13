'use client';
import PrimarySiteNav from '../primary-site-nav';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {MapPin,Plus,Check,Camera,Package,Store,Pencil,Sparkles,Navigation,FileText} from 'lucide-react';
import {money,route,type Product,type Shop} from '@/lib/model';
import {listingSteps,listingMissing,listingIssues,listingPrice,type ListingDraft,type ListingSuggestion} from '@/lib/listing-guide';
import ListingAssistant from './listing-assistant';
import PhoneImport from './phone-import';
import SellerLocation from './seller-location';
import './reference-listing.css';
function emptyDraft(shop:Shop|null,accountName:string):ListingDraft{return {id:crypto.randomUUID(),sellerName:savedSellerName(shop,accountName),sellerType:shop?.sellerType||(shop?'business':'private'),companyName:shop&&shop.sellerType!=='private'?shop.name:'',name:'',description:'',category:'Личные вещи',condition:'',price:'',priceMode:'fixed',photos:[],city:shop?.city||'',street:shop?.street||'',phone:shop?.phone||'',point:shop&&Number.isFinite(shop.lat)&&Number.isFinite(shop.lng)?{label:shop.street,city:shop.city,lat:shop.lat,lng:shop.lng}:null};}
function savedSellerName(shop:Shop|null,accountName:string){
 return (shop?.sellerName||(shop?.sellerType==='private'?shop.name:'')||accountName).trim().slice(0,100);
}
function profileFields(draft:ListingDraft,shop:Shop|null,accountName:string):ListingDraft{
 return {...draft,sellerName:draft.sellerName??savedSellerName(shop,accountName),sellerType:draft.sellerType||shop?.sellerType||(shop?'business':'private'),companyName:draft.companyName??(shop?.sellerType==='private'?'':shop?.name||'')};
}
export default function ListingEditor({initialShop,accountName,storeMode=false}:{initialShop:Shop|null;accountName:string;storeMode?:boolean}){
 const [shop,setShop]=useState(initialShop),[products,setProducts]=useState<Product[]>([]),[draft,setDraft]=useState<ListingDraft>(()=>({...emptyDraft(initialShop,accountName),...(storeMode&&!initialShop?{sellerType:"business" as const}:{})})),[step,setStep]=useState(storeMode&&!initialShop?1:0),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[published,setPublished]=useState(false),[ready,setReady]=useState(false),[saveStatus,setSaveStatus]=useState('Открываем черновик…');
 const [focusField,setFocusField]=useState<string|null>(null);
 const [editingSeller,setEditingSeller]=useState(false);
 const [assistantEntry,setAssistantEntry]=useState({revision:0,open:false});
 const [hasConflict,setHasConflict]=useState(false);
 const [stockNotice,setStockNotice]=useState('');
 const previousAccountName=useRef(savedSellerName(null,accountName));
 useEffect(()=>{
  const previous=previousAccountName.current;
  const current=savedSellerName(null,accountName);
  previousAccountName.current=current;
  if(!shop&&previous!==current)setDraft(d=>d.sellerName===previous?{...d,sellerName:current}:d);
 },[accountName,shop]);
 const version=useRef(0),lastSaved=useRef(''),queue=useRef<Promise<boolean>>(Promise.resolve(true)),conflict=useRef(false),publishing=useRef(false);
 function update(patch:Partial<ListingDraft>){setDraft(d=>({...d,...patch}));setConsent(false);setError('');}
 async function restore(storeId:string){const r=await fetch('/api/connect?draft='+encodeURIComponent(storeId),{cache:'no-store'});if(!r.ok)throw Error('Не удалось открыть объявления.');const b=await r.json() as {shop:Shop;products:Product[]};setShop(b.shop);setProducts(b.products);return b.shop;}
 async function loadDraft(){setReady(false);setError('');try{const r=await fetch('/api/listings/draft',{cache:'no-store'}),b=await r.json() as {draft:ListingDraft|null;version:number;error?:string};if(!r.ok)throw Error(b.error||'Не удалось открыть черновик.');version.current=b.version;conflict.current=false;setHasConflict(false);if(b.draft){const restored=profileFields(b.draft,shop,accountName);setDraft(restored);lastSaved.current=JSON.stringify(restored);setStep(!shop&&!storeMode?([0,1].find(s=>listingMissing(restored,s).length)??2):!shop?1:([1,0].find(s=>listingMissing(restored,s).length)??2));setSaveStatus('Черновик восстановлен из аккаунта');}else{let next=emptyDraft(shop,accountName);try{const anchor=JSON.parse(sessionStorage.getItem('ng_search_anchor')||'null');if(!next.city&&typeof anchor?.city==='string'&&Date.now()-anchor.at<1800000)next={...next,city:anchor.city};}catch{}setDraft(next);setStep(storeMode&&!shop?1:0);lastSaved.current='';setSaveStatus('Изменения сохраняются в аккаунте');}setReady(true);}catch(e){setError((e as Error).message);setSaveStatus('Черновик не открыт');}}
 useEffect(()=>{void loadDraft();if(initialShop)void restore(initialShop.id).catch(e=>setError((e as Error).message));},[initialShop]); // eslint-disable-line react-hooks/exhaustive-deps
 function persist(next:ListingDraft){const serialized=JSON.stringify(next);queue.current=queue.current.then(async()=>{if(conflict.current)return false;if(serialized===lastSaved.current)return true;setSaveStatus('Сохраняем черновик…');try{const r=await fetch('/api/listings/draft',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:next,version:version.current})}),b=await r.json() as {version:number;error?:string};if(!r.ok){if(r.status===409){conflict.current=true;setHasConflict(true);}throw Error(b.error||'Не удалось сохранить черновик.');}version.current=b.version;lastSaved.current=serialized;setSaveStatus('Черновик сохранён в аккаунте');return true;}catch(e){setSaveStatus((e as Error).message);return false;}});return queue.current;}
 useEffect(()=>{if(!ready||saved||publishing.current)return;const timer=setTimeout(()=>{if(!publishing.current)void persist(draft);},1000);return()=>clearTimeout(timer);},[draft,ready,saved]); // eslint-disable-line react-hooks/exhaustive-deps

 async function upload(files:FileList|null){if(!files)return;setUploading(true);setError('');try{for(const file of Array.from(files).slice(0,5-draft.photos.length)){if(file.size>5*1024*1024)throw Error('Каждое фото должно быть меньше 5 МБ.');const r=await fetch('/api/catalog',{method:'PUT',headers:{'Content-Type':file.type},body:file}),b=await r.json() as {error?:string;url:string};if(!r.ok)throw Error(b.error||'Не удалось загрузить фото.');setDraft(d=>({...d,photos:[...d.photos,b.url]}));setConsent(false);}}catch(e){setError((e as Error).message);}finally{setUploading(false);}}
 async function submit(e:FormEvent){e.preventDefault();const [issue]=listingIssues(draft,2);if(issue){goToField(issue.field,issue.step);return;}if(!consent||!draft.point)return;publishing.current=true;setBusy(true);setError('');try{if(!await persist(draft))throw Error('Сначала сохраните черновик. '+(conflict.current?'Откройте актуальную версию из аккаунта.':'Проверьте подключение и попробуйте ещё раз.'));const r=await fetch('/api/listings',{method:products.some(p=>p.id===draft.id)?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:draft.id,sellerName:draft.sellerName,sellerType:draft.sellerType||'private',companyName:draft.companyName||'',name:draft.name,description:draft.description,category:draft.category||'Личные вещи',condition:draft.condition,price:listingPrice(draft),priceMode:draft.priceMode,photos:draft.photos,city:draft.city,street:draft.street,lat:draft.point.lat,lng:draft.point.lng,phone:draft.phone,consent})}),b=await r.json() as {error?:string;storeId?:string;status?:'published'|'pending'};if(!r.ok)throw Error(b.error||'Не удалось отправить объявление.');if(b.storeId){const owner=await restore(b.storeId);setDraft(d=>profileFields(d,owner,accountName));}version.current=0;setPublished(b.status==='published');setSaved(true);setSaveStatus('Объявление сохранено');}catch(e){setError((e as Error).message);}finally{publishing.current=false;setBusy(false);}}
 async function withdraw(product:Product){setBusy(true);setError('');try{const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'product',id:product.id,data:{...product,published:false,quantity:0,stockConfirmed:true}})}),b=await r.json() as {error?:string};if(!r.ok)throw Error(b.error||'Не удалось снять объявление.');await restore(product.storeId);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function updateStock(product:Product,quantity:number){
  if(!Number.isInteger(quantity)||quantity<0||quantity>10000000){setError('Укажите количество от 0 до 10 000 000.');return;}
  setBusy(true);setError('');setStockNotice('');
  try{
   const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'product',id:product.id,data:{...product,quantity,stockConfirmed:true,published:quantity===0?false:product.published}})});
   const b=await r.json() as {error?:string};
   if(!r.ok)throw Error(b.error||'Не удалось обновить остаток.');
   await restore(product.storeId);
   setStockNotice(quantity===0?'Товар снят с продажи. Для повторной публикации откройте карточку.':'Остаток товара обновлён.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!ready)return;
  if(!focusField)document.getElementById('listing-step-fields')?.scrollIntoView({block:'start',behavior:'smooth'});
 },[step]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(!focusField)return;
  document.getElementById('listing-'+focusField)?.focus();
  setFocusField(null);
 },[focusField]);
 function goToField(field:string,targetStep:number){
  if(targetStep===1)setEditingSeller(true);
  setStep(targetStep);
  setFocusField(field);
 }
 function another(){if((draft.name||draft.photos.length)&&!saved&&!window.confirm('Начать новое объявление? Текущий черновик будет заменён.'))return;setDraft(emptyDraft(shop,accountName));setAssistantEntry({revision:0,open:false});setEditingSeller(false);setConsent(false);setSaved(false);setStep(storeMode&&!shop?1:0);setError('');}
 useEffect(()=>{
  const anchor=window.location.hash.slice(1);
  if(anchor.startsWith('listing-'))document.getElementById(anchor)?.scrollIntoView({block:'start'});
 },[products]);

 const openedEdit=useRef(false);
 useEffect(()=>{
  if(!ready||openedEdit.current)return;
  const id=new URLSearchParams(window.location.search).get('edit');
  if(!id)return;
  const product=products.find(item=>item.id===id);
  if(!product)return;
  openedEdit.current=true;
  void edit(product);
 },[ready,products]); // eslint-disable-line react-hooks/exhaustive-deps
 async function edit(product:Product,withAssistant=false){
  if(product.id!==draft.id||saved){
   if((draft.name||draft.photos.length)&&!saved&&!window.confirm('Открыть это объявление? Текущий черновик будет заменён.'))return;
   await queue.current;
   setDraft({
    ...emptyDraft(shop,accountName),id:product.id,name:product.name,
    description:product.description,category:product.category,
    condition:product.condition==='new'||product.condition==='used'?product.condition:'',
    price:product.price===null?'':String(product.price),
    priceMode:product.priceMode||(product.price===null?'negotiable':'fixed'),
    photos:product.photos,
   });
   setConsent(false);
  }
  setAssistantEntry(entry=>({revision:entry.revision+1,open:withAssistant}));
  setSaved(false);
  setStep(0);
  setError('');
  requestAnimationFrame(()=>document.getElementById(withAssistant?'listing-assistant-panel':'listing-step-fields')?.scrollIntoView({block:'start'}));
 }
 async function continueFromSeller(){
  if(listingMissing(draft,1).length||!draft.point||busy)return;
  if(!shop){
   setBusy(true);
   setError('');
   try{
    if(!await persist(draft))throw Error('Не удалось сохранить черновик. Повторите попытку.');
    const sellerName=(draft.sellerName||'').trim();
    const sellerType=draft.sellerType||'private';
    const response=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     action:'saveStore',
     data:{sellerName,sellerType,name:sellerType==='business'?draft.companyName:sellerName,phone:draft.phone,city:draft.city,street:draft.street,lat:draft.point.lat,lng:draft.point.lng},
    })});
    const result=await response.json() as {shop?:Shop;error?:string};
    if(!response.ok||!result.shop)throw Error(result.error||'Не удалось сохранить данные продавца.');
    setShop(result.shop);
   }catch(e){setError((e as Error).message);return;}
   finally{setBusy(false);}
  }
  setEditingSeller(false);
  setStep(listingMissing(draft,0).length?0:2);
 }
 function applySuggestion(p:ListingSuggestion){const {price,...fields}=p;update({...fields,...(price!==undefined?{price:String(price)}:{})});}
 const addressText=draft.street.split(',').some(p=>p.trim().toLocaleLowerCase()===draft.city.trim().toLocaleLowerCase())?draft.street:[draft.city,draft.street||'Место пока не выбрано'].join(', ');
 const missing=listingIssues(draft,step),allMissing=listingMissing(draft,2),displayPrice=draft.priceMode==='negotiable'?'Цена договорная':draft.priceMode==='free'?'Отдам бесплатно':money(draft.price===''?null:Number(draft.price));
 const sellerSaved=!!shop&&!editingSeller&&!listingMissing(draft,1).length;
 const steps=sellerSaved&&step!==1?[0,2]:storeMode?[1,0,2]:[0,1,2];
 const previousStep=steps[steps.indexOf(step)-1];
 const stepLabels=storeMode?["Товары","Адрес и контакты","Предпросмотр"]:listingSteps;
 const editing=products.some(p=>p.id===draft.id);
 const publicCount=products.filter(p=>p.published&&p.quantity!==0&&shop?.visibility==='public').length;
 const reviewCount=products.filter(p=>p.published&&p.quantity!==0&&shop?.visibility!=='public').length;
 return <main className="business-demo marketplace-flow design listing-editor unified-seller">
 <header className="seller-primary-header"><a className="seller-primary-brand" href="/">Найди<span>Go</span></a><PrimarySiteNav current="Разместить"/></header>
 <section className="unified-intro"><div><p className="business-kicker">ТОВАРЫ РЯДОМ · ЛЮДИ И МАГАЗИНЫ</p><h1>{saved?(published?'Объявление опубликовано':'Объявление отправлено'):editing?'Изменить объявление':storeMode?'Подключение магазина':'Разместить объявление'}</h1><p>{saved?(published?'Товар доступен покупателям в поиске и на карте.':'Всё сохранено. После проверки товар появится в поиске и на карте.'):storeMode?'Добавьте магазин в НайдиGo, чтобы покупатели находили ваши товары рядом.':'Фото → готовая карточка → покупатель рядом.'}</p></div><div className="unified-mini-map" aria-hidden="true"><span className="map-path"/><MapPin className="map-pin-one"/><Store className="map-pin-two"/><Package className="map-pin-three"/><small>Покупатели рядом</small></div></section>
 <section className="business-step">
 {error&&<p role="alert">{error}</p>}
 {saved?<div className="unified-saved"><Check size={32}/><h2>{published?'Карточка в поиске':'Карточка на проверке'}</h2><p>Статус можно посмотреть ниже, в своих объявлениях.</p><button className="d-btn" type="button" onClick={another}><Plus size={16}/>Добавить ещё товар</button></div>:!ready?<button className="d-btn secondary" type="button" onClick={()=>void loadDraft()}>Открыть сохранённый черновик</button>:<>
 <div className="listing-save-row"><p className="listing-autosave" role="status">{saveStatus}</p>{editing&&<button type="button" className="listing-withdraw" onClick={another}>Новое объявление</button>}</div>
 {hasConflict&&<button className="d-btn secondary" onClick={()=>void loadDraft()}>Открыть актуальный черновик</button>}
 {sellerSaved&&step!==1&&<div className="listing-assistant-actions">
 <button type="button" className="d-btn secondary" onClick={()=>goToField('seller-name',1)}>Изменить продавца и место</button>
 </div>}
 <nav className="listing-steps" style={{gridTemplateColumns:`repeat(${steps.length}, minmax(0, 1fr))`}} aria-label={storeMode?"Шаги подключения магазина":"Шаги объявления"}>{steps.map((i,index)=><button type="button" key={i} aria-current={step===i?'step':undefined} className={step===i?'active':''} disabled={busy} onClick={()=>setStep(i)}><span>{i<2&&!listingMissing(draft,i).length?<Check size={15}/>:index+1}</span>{stepLabels[i]}</button>)}</nav>
 {storeMode&&step===0&&<div className="store-assortment-workspace">
 <aside className="store-assortment-details" aria-labelledby="store-details-title">
  <h2 id="store-details-title"><Store size={20}/> Данные магазина</h2>
  {shop?.photos?.[0]&&<img src={shop.photos[0]} alt="Фото магазина"/>}
  <strong>{draft.companyName?.trim()||'Название ещё не указано'}</strong>
  <p>{[draft.city,draft.street].filter(Boolean).join(' · ')||'Адрес ещё не указан'}</p>
  <p>{draft.phone||'Телефон ещё не указан'}</p>
  <button className="d-btn secondary" type="button" onClick={()=>goToField('company',1)}><Pencil size={16}/> Изменить данные магазина</button>
 </aside>
 <section className="store-assortment" aria-labelledby="store-assortment-title">
  <div className="store-assortment-heading">
   <h2 id="store-assortment-title">Ассортимент магазина</h2>
   {shop?.sellerType==='business'&&<a href="/#products"><FileText size={16}/> Импорт CSV/XLSX</a>}
  </div>
  {products.length>0?<div className="store-assortment-scroll"><table>
   <thead><tr><th scope="col">Товар</th><th scope="col">Цена</th><th scope="col">Остаток</th><th scope="col">Статус</th><th scope="col">Действия</th></tr></thead>
   <tbody>{products.map(product=><tr key={product.id}>
    <th scope="row"><span>{product.photos[0]?<img src={product.photos[0]} alt="" loading="lazy"/>:<Package size={20}/>} {product.name}</span></th>
    <td>{product.price==null?'Уточнить':money(product.price)}</td>
    <td>{product.quantity??'Не указан'}</td>
    <td>{product.quantity===0?'Снят с продажи':product.published&&shop?.visibility==='public'?'В поиске':'На проверке'}</td>
    <td><button type="button" className="d-btn secondary" disabled={busy} onClick={()=>void edit(product)} aria-label={'Редактировать '+product.name}><Pencil size={16}/></button></td>
   </tr>)}</tbody>
  </table></div>:<p>Здесь появятся добавленные товары. Заполните первую карточку ниже.</p>}
 </section></div>}
 <form onSubmit={e=>void submit(e)} className="listing-form" noValidate><fieldset className={step===0?"unified-form-fields with-live-preview":"unified-form-fields"} disabled={busy}><h2 id="listing-step-fields">{stepLabels[step]}</h2>
 <ListingAssistant key={draft.id+":"+assistantEntry.revision} initiallyOpen={assistantEntry.open} editing={editing} draft={draft} step={step} disabled={busy||uploading} onApply={applySuggestion}/>
 {step===0&&<>
 <p>Три шага: расскажите о товаре → укажите место передачи → проверьте готовую карточку.</p>
 <h3 className="listing-field-heading">1. Фотографии</h3>
 <label className="unified-photo-picker"><Camera size={28}/><b>Добавьте фотографии товара</b><small>До 5 фото · JPG, PNG, WebP · до 5 МБ</small><input id="listing-photos" aria-label="Фотографии товара" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading||draft.photos.length>=5||busy} onChange={e=>void upload(e.target.files)}/></label>
 {uploading&&<p role="status">Загружаем фотографии…</p>}
 <div className="listing-photos">{draft.photos.map(src=><div key={src}><img src={src} alt="Фото объявления"/><button type="button" aria-label="Удалить фото" disabled={busy} onClick={()=>update({photos:draft.photos.filter(p=>p!==src)})}>×</button></div>)}</div>
 </>}
 {step===0&&<>
 <h3 className="listing-field-heading">2. Что продаёте</h3>
 <label>Название товара <small>Обязательно</small><input id="listing-name" minLength={3} maxLength={200} value={draft.name} onChange={e=>update({name:e.target.value})} placeholder="Например: детский велосипед"/></label>
 <label>Категория <small>Помогает найти объявление</small><input id="listing-category" maxLength={100} value={draft.category} onChange={e=>update({category:e.target.value})} placeholder="Например: Велосипеды"/></label>
 <h3 className="listing-field-heading">3. Состояние и цена</h3>
 <div className="unified-field-pair"><label>Состояние <small>Обязательно</small><select id="listing-condition" value={draft.condition} onChange={e=>update({condition:e.target.value as ListingDraft['condition']})}><option value="">Выберите состояние</option><option value="used">Б/у</option><option value="new">Новый</option></select></label>
 <label>Цена, ₽ <small>{draft.priceMode==='fixed'?'Обязательно':'Сумма не требуется'}</small><input id="listing-price" type="number" min="0" max="1000000000" step="0.01" disabled={draft.priceMode!=='fixed'} value={draft.priceMode==='free'?'0':draft.priceMode==='negotiable'?'':draft.price} onChange={e=>update({price:e.target.value})} placeholder="Укажите цену"/></label></div>
 <fieldset className="listing-price-options"><legend>Вариант цены</legend>{(['fixed','negotiable','free'] as const).map(mode=><label key={mode}><input type="radio" name="priceMode" checked={draft.priceMode===mode} onChange={()=>update({priceMode:mode})}/>{mode==='fixed'?'Укажу цену':mode==='negotiable'?'Цена договорная':'Отдам бесплатно'}</label>)}</fieldset>
 <h3 className="listing-field-heading">4. Описание</h3><label>Описание <small>Обязательно</small><textarea id="listing-description" minLength={10} maxLength={4000} value={draft.description} onChange={e=>update({description:e.target.value})} placeholder="Что продаёте, особенности и что входит в комплект"/></label>
 </>}
 {step===1&&<>
 <p>Укажите имя, телефон и место передачи. Сохраним эти данные для следующих объявлений.</p>
 {shop&&<p className="business-demo-notice">Изменения профиля сохранятся при отправке объявления и могут потребовать повторной проверки.</p>}
 <label>Как вас зовут? <small>Имя продавца</small><input id="listing-seller-name" autoComplete="given-name" minLength={2} maxLength={100} value={draft.sellerName||''} onChange={e=>update({sellerName:e.target.value})} placeholder="Например, Анна"/></label>
 <label>Телефон для связи <small>Обязательно</small><input id="listing-phone" minLength={5} maxLength={100} type="tel" value={draft.phone} onChange={e=>update({phone:e.target.value})} placeholder="+7"/></label>
 <PhoneImport phone={draft.phone} onPhone={phone=>update({phone})}/>
 <div className="unified-company">
 {draft.sellerType==='business'?<>
 <label>Название магазина или компании <small>Обязательно</small><input id="listing-company" maxLength={200} minLength={2} value={draft.companyName||''} onChange={e=>update({companyName:e.target.value})} placeholder="Как вас увидят покупатели"/></label>
 {shop?.sellerType!=='business'&&<button className="d-btn secondary" type="button" onClick={()=>update({sellerType:'private'})}>Размещаю как частный продавец</button>}
 </>:<p className="d-fine">Вы размещаете объявление от своего имени. Витрину можно оформить позже.</p>}
 </div>
 <SellerLocation draft={draft} onChange={update}/>
 <p className="d-fine">В аккаунте одна точка для всех объявлений. Можно выбрать магазин или общедоступное место встречи. Контакт станет доступен после публикации.</p>
 </>}
 {step===2&&<>
 <article className="listing-final-preview unified-preview"><div className="listing-photos">{draft.photos.map(src=><img key={src} src={src} alt="Фото товара"/>)}</div><div className="unified-preview-body"><small>{draft.condition==='used'?'Б/у':draft.condition==='new'?'Новый':'Состояние не выбрано'}</small><h3>{draft.name||'Название ещё не заполнено'}</h3><strong>{displayPrice}</strong><p>{draft.description}</p><div className="unified-seller-label">{draft.sellerType==='business'?<Store size={18}/>:<Package size={18}/>}<b>{draft.sellerType==='business'?draft.companyName:draft.sellerName||'Частный продавец'}</b><small>Отзывы пока не собраны</small></div><p className="listing-final-address"><MapPin size={15}/>{addressText}</p><p>Контакт: {draft.phone||'Не указан'}</p>{draft.point&&<a href={`https://yandex.ru/maps/?rtext=~${draft.point.lat},${draft.point.lng}&rtt=auto`} target="_blank" rel="noreferrer"><Navigation size={15}/>Посмотреть маршрут к точке</a>}</div></article>
 <section className="listing-publication-consent" aria-labelledby="listing-consent-title">
 <h3 id="listing-consent-title"><FileText size={18} aria-hidden="true"/> Условия и согласие</h3>
 <div className="listing-legal-links">
 <a href="/legal/terms" target="_blank" rel="noopener"><FileText size={16} aria-hidden="true"/>Условия сервиса</a>
 <a href="/legal/personal-consent" target="_blank" rel="noopener"><FileText size={16} aria-hidden="true"/>Согласие на обработку данных</a>
 </div>
 <label className="seller-consent"><input id="listing-consent" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Подтверждаю, что могу продать товар, фотографии мои, данные верны. Согласен на публикацию объявления и контакта, принимаю условия и даю согласие на обработку данных.</span></label>
 </section>
 </>}
 {(missing.length>0||(step===2&&!consent))&&<div className="listing-missing">
 <b>Что осталось заполнить</b>
 <ul>{missing.map(issue=><li key={issue.field}><button type="button" onClick={()=>goToField(issue.field,issue.step)}>{issue.message}</button></li>)}
 {step===2&&!consent&&<li><button type="button" onClick={()=>goToField('consent',2)}>Подтвердите данные и согласие</button></li>}</ul>
 </div>}
 <div className="listing-wizard-actions">
 {previousStep!==undefined&&<button className="d-btn secondary" type="button" onClick={()=>setStep(previousStep)}>Назад</button>}
 {step===1?<button className="d-btn" type="button" disabled={!!missing.length||uploading} onClick={()=>void continueFromSeller()}>{listingMissing(draft,0).length?'Сохранить и перейти к товару':'Далее: Проверка'}</button>:
 step===0?<button className="d-btn" type="button" disabled={!!missing.length||uploading} onClick={()=>{setStep(sellerSaved?2:1);setError('');}}>{sellerSaved?'Далее: Проверка':'Далее: Место и продавец'}</button>:
 <button className="d-btn" type="submit" disabled={busy||uploading||!!allMissing.length||!consent||hasConflict}>{busy?'Проверяем и сохраняем…':editing?'Сохранить изменения':'Проверить и опубликовать'}</button>}
 </div>
 </fieldset></form></>}
 </section>
 <section className="listing-mine unified-my" id="my-listings"><div className="unified-section-heading"><div><h2>Мои объявления</h2><p>Здесь можно проверить статус, изменить цену и остаток или снять карточку с продажи.</p></div>{saved&&<button className="d-btn secondary" type="button" onClick={another}><Plus size={16}/>Добавить товар</button>}</div><div className="listing-mine-summary"><span><b>{products.length}</b> всего</span><span><b>{publicCount}</b> в поиске</span><span><b>{reviewCount}</b> на проверке</span></div>{stockNotice&&<p className="unified-stock-notice" role="status">{stockNotice}</p>}
 {!products.length?<div className="unified-empty"><Package size={32}/><p>Здесь появятся ваши товары и их статусы. Начните с первого фото выше.</p></div>:<div className="unified-products">{products.map(p=><article key={p.id} id={'listing-'+encodeURIComponent(p.id)}><div className="unified-product-image">{p.photos[0]?<img src={p.photos[0]} alt={p.name}/>:<Package size={32}/>}</div><div className="unified-product-body"><small className={'unified-status '+(p.quantity===0?'inactive':p.published&&shop?.visibility==='public'?'public':'pending')}>{p.quantity===0?'Снято с продажи':p.published&&shop?.visibility==='public'?'В поиске':'На проверке'}</small><h3>{p.name}</h3><strong>{p.priceMode==='free'?'Бесплатно':p.price===null?'Договорная':money(p.price)}</strong><p>{p.condition==='used'?'Б/у':p.condition==='new'?'Новый':'Состояние не указано'}</p><p><MapPin size={14}/>{shop?.city}, {shop?.street}</p>{p.quantity!==0&&<form className="unified-stock-edit" onSubmit={e=>{e.preventDefault();const value=Number(new FormData(e.currentTarget).get('quantity'));void updateStock(p,value);}}><label>Остаток <input key={p.id+':'+p.quantity} name="quantity" type="number" min="0" max="10000000" step="1" required defaultValue={p.quantity??''} placeholder="Не указан" aria-label={`Остаток: ${p.name}`}/></label><button type="submit" disabled={busy}>Сохранить</button></form>}<div className="unified-product-actions"><a href="/messages">Сообщения покупателей</a><button type="button" disabled={busy} onClick={()=>void edit(p)}><Pencil size={14}/>Изменить</button><button type="button" disabled={busy||uploading||!ready} onClick={()=>void edit(p,true)}><Sparkles size={14}/>Изменить с помощником</button>{shop&&<a href={route(shop)} target="_blank" rel="noreferrer"><Navigation size={14}/>Маршрут</a>}{p.quantity!==0&&<button type="button" disabled={busy} onClick={()=>void withdraw(p)}>Снять с продажи</button>}</div></div></article>)}</div>}
 </section>
 <PrimarySiteNav current="Разместить" mobile/>
 </main>;
}
