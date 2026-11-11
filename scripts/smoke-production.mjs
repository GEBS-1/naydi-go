// Run on the VPS: HTTPS through its real nginx virtual host; no bot messages.
import https from 'node:https';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {postgresSettings} from './postgres-migrate.mjs';
const base='https://naydigo.prepromo.ru';
function request(path,{method='GET',body,cookie='',origin=base}={}){
 return new Promise((resolve,reject)=>{
  const req=https.request(base+path,{method,lookup:(_host,options,callback)=>options.all?callback(null,[{address:'127.0.0.1',family:4}]):callback(null,'127.0.0.1',4),headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},timeout:15000},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)}));});
  req.on('error',reject);req.on('timeout',()=>req.destroy(Error('HTTPS timeout')));if(body)req.write(JSON.stringify(body));req.end();
 });
}
const pool=new Pool({connectionString:postgresSettings().DATABASE_URL,max:1}),passed=[];
try{
 const db=(await pool.query('SELECT current_database() AS database,(SELECT COUNT(*)::int FROM shops) AS shops,(SELECT COUNT(*)::int FROM products) AS products')).rows[0];
 for(const path of ['/','/connect','/sell','/business-demo','/account']){const page=await request(path);assert.equal(page.status,200);passed.push('HTTPS '+path);if(path==='/business-demo'){const assets=[...page.text.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>m[1]).filter(p=>p.startsWith('/_next/static/'));assert.ok(assets.length);for(const asset of assets.slice(0,3))assert.equal((await request(asset)).status,200);passed.push('Published client assets available');}}
 const seller=(await request('/api/connect?seller=1')).json();assert.deepEqual(seller.providers,{telegram:true,max:true});passed.push('Only Telegram/MAX available');
 const account=(await request('/api/buyer/me')).json();assert.equal(account.providers.yandex,false);assert.equal(account.providers.email,false);passed.push('Other sign-in providers disabled');
 for(const provider of ['telegram','max']){
  const login=await request('/api/buyer/auth',{method:'POST',body:{provider}});assert.equal(login.status,200);
  const url=new URL(login.json().url);assert.equal(url.hostname,provider==='telegram'?'t.me':'max.ru');
  const set=login.headers['set-cookie'][0];assert.match(set,/HttpOnly/);assert.match(set,/Secure/);const cookie=set.split(';')[0];
  try{const poll=await request('/api/buyer/auth',{method:'POST',cookie,body:{action:'status'}});assert.equal(poll.status,200);assert.equal(poll.json().authenticated,false);passed.push(provider+' begins login and requires real bot confirmation');}
  finally{const key=createHash('sha256').update(cookie.split('=')[1]).digest('hex');await pool.query('DELETE FROM buyer_logins WHERE browser_hash=$1 AND consumed=0',[key]);}
  const forged=await request('/api/buyer/bots/'+provider,{method:'POST',body:{}});assert.equal(forged.status,403);passed.push(provider+' rejects forged webhook');
 }
 const anonymous=await request('/api/connect',{method:'POST',body:{action:'saveStore',data:{}}});assert.equal(anonymous.status,401);passed.push('Anonymous store creation rejected');
 const listing=await request('/api/listings',{method:'POST',body:{}});assert.equal(listing.status,401);passed.push('Anonymous listing creation rejected');
 const report={checkedAt:new Date().toISOString(),database:db,passed,liveBotConfirmation:false};
 writeFileSync('artifacts-production-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await pool.end();}
