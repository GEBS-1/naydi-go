'use client';
import {useState} from 'react';
import {ArrowRight,Eye,Send,Store} from 'lucide-react';
import {ConnectDialog} from '../discovery/client';
import '../design/design.css';
import '../catalog.css';

export default function ConnectPage(){const [request,setRequest]=useState(false);return <main className="ng-form" style={{maxWidth:920,margin:'35px auto',padding:20}}><a className="d-brand" href="/"><span>Найди<span>Go</span></span></a><p className="d-eyebrow" style={{marginTop:45}}><Store size={16}/>ДЛЯ БИЗНЕСА</p><h1 style={{fontSize:'clamp(36px,6vw,64px)',lineHeight:1.02}}>Посмотрите, как ваш магазин<br/>будет выглядеть в НайдиGo</h1><p className="d-muted">Соберите безопасный демо-черновик без регистрации или оставьте заявку на реальное подключение.</p><div className="d-products" style={{marginTop:28}}><section className="d-panel"><Eye size={34} color="#0866ff"/><h2>Демо-витрина</h2><p>Название, одна из 6 категорий, до 2 фото магазина и 3–5 товаров. Ничего не публикуется.</p><a className="d-btn" href="/business-demo">Собрать демо<ArrowRight size={17}/></a></section><section className="d-panel"><Send size={34} color="#087d4f"/><h2>Подключить магазин</h2><p>Оставьте контакты. Данные попадут на модерацию; магазин не публикуется автоматически.</p><button className="d-btn secondary" onClick={()=>setRequest(true)}>Оставить заявку</button></section></div>{request&&<ConnectDialog city="Казань" onClose={()=>setRequest(false)}/>}</main>}
