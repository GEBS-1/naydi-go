import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
const origin='http://localhost:3000'; // Intentionally no remote override: disposable LOCAL fixture only.
const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const database=new DatabaseSync(path.join(folder,readdirSync(folder).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')));
database.exec('PRAGMA busy_timeout=5000');
const id='qa-publish-'+randomUUID(),email=id+'@example.invalid',token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
let owner,product,photo;
const checks=[],start=performance.now();
const shop={id,name:'Локальный QA — не настоящий магазин',category:'Электроника',description:'Изолированная проверка публикации, удаляется после теста',demo:false,ownerConfirmed:true,personalDemo:false,status:'reference',city:'Казань',street:'QA адрес, не реальная торговая точка',addressConfirmed:false,lat:55.8,lng:49.1,phone:'',email,contact:'',hours:'',site:'',photos:[]};
async function call(url,body,cookie){const r=await fetch(origin+url,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return {b,r};}
function pass(s){checks.push(s);console.log('PASS:',s);}
try{
 // Administrative preparation fixture. This does not claim to test admin identity/gateway.
 database.prepare('INSERT INTO shops(id,owner,visibility,data) VALUES(?,NULL,?,?)').run(id,'public',JSON.stringify(shop));
 database.prepare('INSERT INTO owner_invites(hash,store_id,email,expires_at) VALUES(?,?,?,?)').run(hash,id,email,new Date(Date.now()+600000).toISOString());
 const invite=await call('/api/invite/'+token,{}),cookie=invite.r.headers.get('set-cookie').split(';')[0];
 owner=database.prepare('SELECT owner FROM shops WHERE id=?').get(id).owner;assert(owner);pass('One-time invitation creates real server owner session');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const upload=await fetch(origin+'/api/catalog',{method:'PUT',headers:{Origin:origin,Cookie:cookie,'Content-Type':'image/png'},body:png});const uploaded=await upload.json();assert.equal(upload.status,200,JSON.stringify(uploaded));photo=uploaded.url;
 assert.equal((await fetch(origin+photo)).status,404);assert.equal((await fetch(origin+photo,{headers:{Cookie:cookie}})).status,200);pass('Uploaded R2 image is private before publication');
 const data={storeId:id,name:id+' наушники',category:'Электроника',brand:'QA',model:'fixture',description:'Только локальный тест, не предложение продавца',features:'',price:950,quantity:3,sku:id,published:false,photos:[photo],keywords:id+' ключи',stockConfirmed:true};
 product=(await call('/api/catalog',{action:'product',data},cookie)).b.id;
 assert(!(await call('/api/catalog')).b.products.some(p=>p.id===product));pass('Owner creates draft; anonymous catalog excludes it');
 await call('/api/catalog',{action:'product',id:product,data:{...data,published:true}},cookie);
 let found=(await call('/api/catalog',{action:'search',query:id})).b.products.find(p=>p.id===product);assert.equal(found.price,950);assert.equal(found.quantity,3);
 assert.equal((await fetch(origin+photo)).status,200);pass('Publication exposes product and its image to anonymous catalog search');
 // Ambiguous keyword skips paid sources but still exercises the unified public index.
 const unified=await fetch(origin+'/api/search',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({query:'ключи',city:'Казань'})});
 assert.equal(unified.status,200);const phases=(await unified.text()).trim().split('\n').map(JSON.parse),hit=phases.at(-1).hits.find(h=>h.id===product);assert(hit);assert.equal(hit.price,950);assert.equal(hit.point,null);pass('Unified search sees published owner product; unconfirmed address gets no marker');
 const before=JSON.parse(database.prepare('SELECT data FROM products WHERE id=?').get(product).data);
 database.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify({...before,source:'https://example.invalid/import-fixture',checkedAt:'2020-01-01T00:00:00.000Z'}),product);
 await call('/api/catalog',{action:'product',id:product,data:{...data,published:true,price:800,quantity:1}},cookie);
 found=(await call('/api/catalog',{action:'search',query:id})).b.products.find(p=>p.id===product);assert.equal(found.price,800);assert.equal(found.quantity,1);pass('Owner price/quantity edits persist in D1 and anonymous search');
 assert.equal(found.source,undefined);assert.equal(found.importedSource,'https://example.invalid/import-fixture');assert.equal(found.importedCheckedAt,'2020-01-01T00:00:00.000Z');assert(Date.now()-Date.parse(found.checkedAt)<60000);pass('Owner update refreshes timestamp without falsely attributing new price to imported source');
 database.prepare("UPDATE shops SET visibility='draft' WHERE id=?").run(id);
 assert(!(await call('/api/catalog')).b.products.some(p=>p.id===product));assert.equal((await fetch(origin+photo)).status,404);pass('Unpublishing shop also hides product and photo');
 database.prepare("UPDATE shops SET visibility='public' WHERE id=?").run(id);
 await call('/api/catalog',{action:'product',id:product,data:{...data,published:false}},cookie);assert(!(await call('/api/catalog')).b.products.some(p=>p.id===product));assert.equal((await fetch(origin+photo)).status,404);pass('Owner hides product and removes public photo access');
 await call('/api/catalog',{action:'deleteProduct',id:product},cookie);assert(!database.prepare('SELECT id FROM products WHERE id=?').get(product));pass('Owner deletes own product');
 mkdirSync('artifacts/mvp-20260926',{recursive:true});writeFileSync('artifacts/mvp-20260926/owner-publish.json',JSON.stringify({at:new Date().toISOString(),ms:Math.round(performance.now()-start),checks,fixture:'Local synthetic shop; admin preparation seeded directly, no claim of full browser acceptance',photoStorage:'68-byte QA PNG retained privately in R2; no public reference after cleanup'},null,2));
}finally{
 if(product)database.prepare('DELETE FROM products WHERE id=? AND store_id=?').run(product,id);
 database.prepare('DELETE FROM owner_invites WHERE hash=?').run(hash);
 if(owner){database.prepare('DELETE FROM owner_sessions WHERE user_id=?').run(owner);database.prepare('DELETE FROM owner_accounts WHERE id=? AND email=?').run(owner,email);}
 database.prepare('DELETE FROM shops WHERE id=?').run(id);database.close();
}
