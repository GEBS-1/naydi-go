import assert from 'node:assert/strict';
import {Pool,types} from 'pg';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import {postgresSettings} from './postgres-migrate.mjs';
import {postgresDB} from './postgres-db.mjs';
types.setTypeParser(20,Number);const connectionString=postgresSettings().DATABASE_URL;
const control=new Pool({connectionString,max:1}),schema='chat_test_'+randomBytes(8).toString('hex');await control.query('CREATE SCHEMA '+schema);
const pool=new Pool({connectionString,options:'-c search_path='+schema,max:10});
try{
 for(const f of readdirSync('postgres/migrations').filter(f=>f.endsWith('.sql')).sort())await pool.query(readFileSync('postgres/migrations/'+f,'utf8'));
 globalThis.chatDB=postgresDB(pool);globalThis.chatEnv={BUYER_AUTH_ENABLED:'1',AUTH_BASE_URL:'https://chat.test'};
 globalThis.chatNotices=[];
 const stubs={'@/lib/account-notify':'export const notifyAccount=async(id,text,path)=>{globalThis.chatNotices.push({id,text,path});return true;};','@/db':'export const db=()=>globalThis.chatDB;','@/lib/server-env':'export const env=globalThis.chatEnv;','@/app/chatgpt-auth':'export const getChatGPTUser=async()=>null;'};
 const bundled=await build({stdin:{contents:"export * from './app/api/messages/route';export * as demo from './app/api/dev/chat-demo/route';export * as stats from './app/api/seller/stats/route';export * as profile from './app/api/buyer/me/route';export * as phone from './app/api/buyer/phone/route';export {publicIndex} from './lib/discovery-server';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));}}]});
 const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
 async function session(id,provider=id.split(':')[0]){const raw=randomBytes(32).toString('hex');await pool.query('INSERT INTO buyer_accounts(id,provider,subject,name,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[id,id.split(':')[0],id.split(':')[1],'Имя '+id,Date.now()]);await pool.query('INSERT INTO buyer_sessions(hash,buyer_id,expires_at,login_provider) VALUES($1,$2,$3,$4)',[createHash('sha256').update(raw).digest('hex'),id,Date.now()+600000,provider]);return 'ng_buyer='+raw;}
 const seller=await session('telegram:seller'),buyer=await session('max:buyer'),stranger=await session('telegram:other'),legacy=await session('yandex:old');
 await pool.query('INSERT INTO buyer_contact_phones(buyer_id,phone,provider,updated_at) VALUES($1,$2,$3,$4)',['max:buyer','+79000000000','max',Date.now()]);
 assert.equal((await api.phone.GET(new Request('https://chat.test/api/buyer/phone'))).status,401);
 const ownPhone=await (await api.phone.GET(new Request('https://chat.test/api/buyer/phone',{headers:{Cookie:buyer}}))).json();
 const otherPhone=await (await api.phone.GET(new Request('https://chat.test/api/buyer/phone',{headers:{Cookie:stranger}}))).json();
 assert.equal(ownPhone.phone,'+79000000000');
 assert.equal(otherPhone.phone,'');
 const storeId=randomUUID(),productId=randomUUID(),product2=randomUUID(),unowned=randomUUID();
 const shop={id:storeId,name:'Магазин рядом',sellerType:'business',city:'Казань',street:'Тестовая, 12',lat:55.8,lng:49.1,photos:[],status:'connected',demo:false,addressConfirmed:true,visibility:'public'};
 const product={id:productId,storeId,name:'Велосипед',photos:[],quantity:1,published:true,demo:false,price:5500};
 await pool.query("INSERT INTO shops(id,owner,data,visibility) VALUES($1,$2,$3,'public')",[storeId,'telegram:seller',JSON.stringify(shop)]);
 for(const id of [productId,product2])await pool.query('INSERT INTO products(id,store_id,published,data) VALUES($1,$2,1,$3)',[id,storeId,JSON.stringify({...product,id})]);
 await pool.query("INSERT INTO shops(id,owner,data,visibility) VALUES($1,NULL,$2,'public')",[unowned,JSON.stringify({...shop,id:unowned})]);
 const unavailable=randomUUID();await pool.query('INSERT INTO products(id,store_id,published,data) VALUES($1,$2,1,$3)',[unavailable,unowned,JSON.stringify({...product,id:unavailable,storeId:unowned})]);
 async function call(method,path='',body=undefined,cookie='',status=200,origin='https://chat.test'){
  const req=new Request('https://chat.test/api/messages'+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const r=await api[method](req),b=await r.json();assert.equal(r.status,status,JSON.stringify(b));assert.match(r.headers.get('cache-control'),/no-store/);return b;
 }
 await call('GET','',undefined,'',401);await call('POST','',{action:'start',productId},'',401);await call('GET','',undefined,legacy,401);await call('POST','',{action:'start',productId},buyer,403,'https://elsewhere.test');
 await call('POST','',{action:'start',productId},seller,400);await call('POST','',{action:'start',productId:unavailable},buyer,404);
 const [a,b]=await Promise.all([call('POST','',{action:'start',productId},buyer),call('POST','',{action:'start',productId},buyer)]);assert.equal(a.thread.id,b.thread.id);const id=a.thread.id;
 assert.equal((await pool.query('SELECT COUNT(*) n FROM chat_threads')).rows[0].n,1);
 await call('GET','?thread='+id,undefined,stranger,404);await call('POST','',{action:'send',threadId:id,id:randomUUID(),text:'Чужое'},stranger,404);await call('POST','',{action:'read',threadId:id,ids:[randomUUID()]},stranger,404);
 await call('POST','',{action:'send',threadId:id,id:randomUUID(),text:'   '},buyer,400);await call('POST','',{action:'send',threadId:id,id:randomUUID(),text:'x'.repeat(2001)},buyer,400);
 const messageId=randomUUID(),send={action:'send',threadId:id,id:messageId,text:'Здравствуйте! Можно забрать сегодня?'};
 await Promise.all([call('POST','',send,buyer),call('POST','',send,buyer)]);assert.equal((await pool.query('SELECT COUNT(*) n FROM chat_messages')).rows[0].n,1);
 assert.equal(globalThis.chatNotices.length,1,'Duplicate send must not duplicate notice');assert.equal(globalThis.chatNotices[0].id,'telegram:seller');
 const stats=await api.stats.GET(new Request('https://chat.test/api/seller/stats',{headers:{Cookie:seller}}));const summary=await stats.json();assert.equal(summary.total,2);assert.equal(summary.published,2);assert.equal(summary.conversations,1);assert.equal(summary.unread,1);assert.equal((await api.stats.GET(new Request('https://chat.test/api/seller/stats'))).status,401);const strangerStats=await (await api.stats.GET(new Request('https://chat.test/api/seller/stats',{headers:{Cookie:stranger}}))).json();assert.equal(strangerStats.total,0);assert.equal(strangerStats.conversations,0);
 const inbox=await call('GET','',undefined,seller);assert.equal(inbox.threads[0].unread,1);assert.equal(inbox.threads[0].role,'seller');assert.equal(inbox.threads[0].otherName,'Имя max:buyer');assert.equal(inbox.threads[0].buyer_id,undefined);
 const rename=(cookie,origin='https://chat.test')=>api.profile.PATCH(new Request('https://chat.test/api/buyer/me',{method:'PATCH',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Анна',id:'telegram:seller'})}));
 assert.equal((await rename('')).status,401);
 assert.equal((await rename(buyer,'https://elsewhere.test')).status,403);
 const renamed=await rename(buyer);
 assert.equal(renamed.status,200);
 assert.equal((await renamed.json()).user.name,'Анна');
 assert.equal((await call('GET','?thread='+id,undefined,seller)).thread.otherName,'Анна');
 assert.equal((await call('GET','?thread='+id,undefined,buyer)).thread.otherName,'Магазин рядом');
 const read=await call('GET','?thread='+id,undefined,seller);assert.equal(read.messages[0].text,send.text);assert.equal(read.messages[0].mine,false);assert.equal((await call('GET','',undefined,seller)).threads[0].unread,1,'GET must not mark messages read');
 await call('POST','',{action:'read',threadId:id,ids:[messageId]},buyer);assert.equal((await call('GET','',undefined,seller)).threads[0].unread,1,'Cannot read own message on behalf of recipient');
 await call('POST','',{action:'read',threadId:id,ids:[messageId]},seller);assert.equal((await call('GET','',undefined,seller)).threads[0].unread,0);assert.ok((await call('GET','?thread='+id,undefined,buyer)).messages[0].readAt);
 const reply=await call('POST','',{action:'send',threadId:id,id:randomUUID(),text:'Да, после 18:00. <script>текст</script>'},seller);assert.equal(reply.message.mine,true);assert.equal((await call('GET','',undefined,buyer)).threads[0].unread,1);
 const linked=await session('max:buyer','telegram');assert.equal((await call('GET','?thread='+id,undefined,linked)).messages.length,2);
 const second=(await call('POST','',{action:'start',productId:product2},buyer)).thread.id;await call('POST','',{...send,threadId:second},buyer,409);await call('POST','',{...send,text:'Изменённый повтор'},buyer,409);
 await pool.query("INSERT INTO chat_messages(id,thread_id,sender_id,body,sent_at) SELECT md5($1||n::text)::uuid::text,$1,'max:buyer','Ранее '||n::text,$2::bigint+n FROM generate_series(1,105) n",[id,Date.now()]);
 const recent=await call('GET','?thread='+id,undefined,seller);assert.equal(recent.messages.length,100);assert.equal(recent.hasMore,true);const previous=await call('GET','?thread='+id+'&before='+recent.before,undefined,seller);assert.equal(previous.messages.length,7);assert.equal(previous.hasMore,false);assert.equal(new Set([...previous.messages,...recent.messages].map(m=>m.id)).size,107);
 const index=await api.publicIndex();assert.equal(index.shops.find(s=>s.id===storeId).chatAvailable,true);assert.equal(index.shops.find(s=>s.id===unowned).chatAvailable,false);
 await pool.query('UPDATE products SET published=0 WHERE id=$1',[productId]);await call('POST','',{action:'start',productId},stranger,404);assert.equal((await call('GET','?thread='+id,undefined,buyer)).thread.available,false);await call('POST','',{action:'send',threadId:id,id:randomUUID(),text:'Договорённость после снятия объявления'},buyer);
 await pool.query('DELETE FROM products WHERE id=$1',[productId]);const preserved=await call('GET','?thread='+id,undefined,seller);assert.equal(preserved.thread.productId,null);assert.ok(preserved.messages.length);
 const oversized=await api.POST(new Request('https://chat.test/api/messages',{method:'POST',headers:{Origin:'https://chat.test',Cookie:buyer},body:'x'.repeat(12001)}));assert.equal(oversized.status,413);
 const previousEnv=process.env.NODE_ENV;try{process.env.NODE_ENV='production';assert.equal((await api.demo.POST(new Request('http://localhost:3001/api/dev/chat-demo?as=buyer',{method:'POST'}))).status,404);process.env.NODE_ENV='development';assert.equal((await api.demo.POST(new Request('https://chat.test/api/dev/chat-demo?as=buyer',{method:'POST'}))).status,404);globalThis.chatEnv.AUTH_BASE_URL='http://localhost:3001';for(const role of ['buyer','seller']){const r=await api.demo.POST(new Request('http://localhost:3001/api/dev/chat-demo?as='+role,{method:'POST',headers:{Origin:'http://localhost:3001'}}));assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/ng_buyer=/);}const demoShop=(await pool.query("SELECT data,visibility FROM shops WHERE owner='telegram:local-chat-seller'")).rows[0];assert.equal(demoShop.visibility,'draft');assert.equal(JSON.parse(demoShop.data).demo,true);}finally{if(previousEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousEnv;}
 console.log('PASS native PostgreSQL: Telegram/MAX identity; guest/foreign access blocked; one dialogue per buyer/product under race; both-way messages, retry deduplication, unread/read receipts, pagination, linked login and persistence after withdrawal/deletion; external sellers have no chat');
}finally{await pool.end();await control.query('DROP SCHEMA '+schema+' CASCADE');await control.end();delete globalThis.chatDB;delete globalThis.chatEnv;}
