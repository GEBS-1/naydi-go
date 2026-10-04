import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readdirSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject',database=new DatabaseSync(path.join(folder,readdirSync(folder).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')));database.exec('PRAGMA busy_timeout=5000');
const origin='http://localhost:3000',id='qa-auth-'+randomUUID(),other=id+'-other',product=id+'-product',email=id+'@example.invalid',raw=randomBytes(32).toString('hex'),hash=createHash('sha256').update(raw).digest('hex');let owner=null;
const base={name:'Только QA авторизации',category:'Дом и ремонт',description:'Тест не для публичной выдачи',demo:true,ownerConfirmed:true,personalDemo:false,status:'reference',city:'Казань',street:'Тестовый адрес',lat:55.8,lng:49.1,phone:'',email,contact:'',hours:'',site:'',photos:[]};
const checks=[];function pass(name){checks.push(name);console.log('PASS:',name);}
async function call(url,body,cookie,extra={}){return fetch(origin+url,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});}
try{
 database.prepare('INSERT INTO shops(id,owner,visibility,data) VALUES(?,NULL,?,?)').run(id,'public',JSON.stringify({...base,id}));
 database.prepare('INSERT INTO shops(id,owner,visibility,data) VALUES(?,?,?,?)').run(other,'unrelated-owner','draft',JSON.stringify({...base,id:other}));
 database.prepare('INSERT INTO products(id,store_id,published,data) VALUES(?,?,0,?)').run(product,other,JSON.stringify({id:product,storeId:other,name:'Закрытый QA товар',photos:[],demo:true}));
 database.prepare('INSERT INTO owner_invites(hash,store_id,email,expires_at) VALUES(?,?,?,?)').run(hash,id,email,new Date(Date.now()+600000).toISOString());
 assert.equal((await call('/api/onboarding',undefined,undefined,{'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':process.env.ADMIN_EMAIL||'admin@example.invalid'})).status,403);pass('Forged identity headers do not grant admin');
 const wrong=await call('/api/invite/'+raw,{},undefined,{Origin:'https://attacker.invalid'});assert(wrong.status>=400);pass('Cross-origin invite rejected');
 const concurrent=await Promise.all([call('/api/invite/'+raw,{}),call('/api/invite/'+raw,{})]);assert.equal(concurrent.filter(r=>r.status===200).length,1);pass('Atomic one-time invitation; concurrent replay denied');
 const response=concurrent.find(r=>r.status===200),setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Lax/);const cookie=setCookie.split(';')[0];owner=database.prepare('SELECT owner FROM shops WHERE id=?').get(id).owner;
 const own=await (await call('/api/catalog',undefined,cookie)).json();assert(own.owned.includes(id));assert(!own.owned.includes(other));assert(!own.stores.some(s=>s.id===other));assert(!own.admin);pass('Session grants only invited store, no other drafts or admin');
 assert.equal((await call('/api/onboarding',undefined,cookie)).status,403);pass('Owner session cannot access administration');
 assert((await call('/api/catalog',{action:'deleteProduct',id:product},cookie)).status>=400);assert(database.prepare('SELECT id FROM products WHERE id=?').get(product));pass('Cannot delete another owner’s product');
 const pub=await (await call('/api/catalog')).json();assert(!pub.stores.some(s=>[id,other].includes(s.id)));assert(!pub.products.some(p=>p.id===product));pass('Test/draft stores excluded from anonymous catalog');
 const logout=await fetch(origin+'/api/owner-session',{method:'DELETE',headers:{Origin:origin,Cookie:cookie}});assert.equal(logout.status,200);const after=await (await call('/api/owner-session',undefined,cookie)).json();assert.equal(after.signedIn,false);pass('Logout revokes server-side session; replayed cookie rejected');
 await writeFile('artifacts/mvp-final/owner-auth-test.json',JSON.stringify({at:new Date().toISOString(),checks,fixture:'Isolated newly created demo/test records; existing stores unchanged'},null,2));
}finally{
 // Exact IDs created by THIS run only. Never touch pre-existing shops or products.
 database.prepare('DELETE FROM owner_invites WHERE hash=?').run(hash);
 if(owner){database.prepare('DELETE FROM owner_sessions WHERE user_id=?').run(owner);database.prepare('DELETE FROM owner_accounts WHERE id=? AND email=?').run(owner,email);}
 database.prepare('DELETE FROM products WHERE id=? AND store_id=?').run(product,other);
 database.prepare('DELETE FROM shops WHERE id IN (?,?)').run(id,other);database.close();
}
