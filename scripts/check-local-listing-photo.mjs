// Explicit live local smoke check: one paid vision call, synthetic image only; no listing published.
import {chromium,request} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,640,480);x.strokeStyle='#cb3030';x.lineWidth=28;x.beginPath();x.arc(402,250,63,0,Math.PI*2);x.stroke();x.fillStyle='#cb3030';x.fillRect(170,135,225,240);x.beginPath();x.ellipse(282,375,112,30,0,0,Math.PI);x.fill();x.fillStyle='#801d1d';x.beginPath();x.ellipse(282,135,112,27,0,0,Math.PI*2);x.fill();return c.toDataURL('image/jpeg',0.8);});
 const api=await request.newContext({baseURL:'http://localhost:3001',extraHTTPHeaders:{Origin:'http://localhost:3001'}});
 try{
  const login=await api.post('/api/dev/seller-session');if(!login.ok())throw Error('Local demo sign-in failed: '+login.status());
  const r=await api.post('/api/listings/assist',{data:{message:'Составь карточку товара по изображению',image,current:{name:'',description:'',category:'Личные вещи'},history:[]},timeout:90000});const b=await r.json();
  console.log(JSON.stringify({http:r.status(),mode:b.mode,suggestion:b.suggestion,error:b.error},null,2));
  if(!r.ok()||b.mode!=='ai'||!b.suggestion?.name||b.suggestion.price!==undefined||b.suggestion.condition!==undefined)throw Error('Vision result failed');
 }finally{await api.dispose();}
}finally{await browser.close();}
