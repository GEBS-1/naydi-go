'use client';
import {useEffect} from 'react';

export default function VisitTracker(){useEffect(()=>{function track(){if(navigator.webdriver||new URLSearchParams(location.search).has('qa'))return;try{if(localStorage.getItem('ng_analytics_consent_v1')!=='yes')return;}catch{return;}const key='ng_visit_'+new Date().toISOString().slice(0,10);try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');}catch{}void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'visit',city:'',category:''}),keepalive:true}).catch(()=>{});}track();addEventListener('ng-analytics-choice',track);return()=>removeEventListener('ng-analytics-choice',track);},[]);return null;}
