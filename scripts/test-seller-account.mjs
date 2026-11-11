// Isolated SQLite, valid synthetic sessions, simulated AI/bot transport. No live shop is created.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {Pool,types} from 'pg';
import {postgresSettings} from './postgres-migrate.mjs';
import {postgresDB} from './postgres-db.mjs';
import {createHash,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const usePostgres=process.argv.includes('--postgres');
const output=usePostgres?'artifacts/postgres-seller':'artifacts/seller-account';mkdirSync(output,{recursive:true});
let sqlite,pgPool,control,schema;
if(usePostgres){
 types.setTypeParser(20,Number);types.setTypeParser(1700,Number);
 control=new Pool({connectionString:postgresSettings().DATABASE_URL,max:1});schema='seller_test_'+randomBytes(8).toString('hex');
 await control.query('CREATE SCHEMA '+schema);
 pgPool=new Pool({connectionString:postgresSettings().DATABASE_URL,options:'-c search_path='+schema,max:10});
 for(const file of readdirSync('postgres/migrations').filter(f=>f.endsWith('.sql')).sort())await pgPool.query(readFileSync('postgres/migrations/'+file,'utf8'));
 globalThis.sellerDB=postgresDB(pgPool);
 sqlite={prepare:sql=>({get:(...args)=>globalThis.sellerDB.prepare(sql).bind(...args).first(),run:(...args)=>globalThis.sellerDB.prepare(sql).bind(...args).run()})};
}else{
 sqlite=new DatabaseSync(':memory:',{enableDoubleQuotedStringLiterals:true});
 for(const file of readdirSync('drizzle').filter(f=>/^\d+.*\.sql$/.test(f)).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const wrap=(sql,args=[])=>({sql,args,bind:(...values)=>wrap(sql,values),first:()=>sqlite.prepare(sql).get(...args)||null,all:()=>({results:sqlite.prepare(sql).all(...args)}),run:()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}})});
 globalThis.sellerDB={prepare:wrap,batch:statements=>{sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
try{
const objects=new Map();globalThis.sellerBucket={put:async(key,bytes,options)=>objects.set(key,{body:bytes,httpMetadata:options.httpMetadata}),get:async key=>objects.get(key)||null};
globalThis.sellerEnv={BUYER_AUTH_ENABLED:'1',AUTH_BASE_URL:'https://seller.test',ADMIN_EMAIL:'admin@test.local',TELEGRAM_BOT_TOKEN:'fixture',TELEGRAM_BOT_USERNAME:'fixture',TELEGRAM_WEBHOOK_SECRET:'fixture',MAX_AUTH_ENABLED:'1',MAX_BOT_TOKEN:'fixture',MAX_BOT_URL:'https://max.ru/fixture',MAX_WEBHOOK_SECRET:'fixture'};
globalThis.sellerAdmin=false;
const stubs={
 '@/lib/account-notify':'export const notifyAccount=async()=>true;',
 '@/lib/server-env':'export const env=globalThis.sellerEnv;',
 '@/db':'export const db=()=>globalThis.sellerDB;export const bucket=()=>globalThis.sellerBucket;',
 '@/app/chatgpt-auth':'export const getChatGPTUser=async()=>globalThis.sellerAdmin?{userId:"admin",email:"admin@test.local"}:null;',
 '@/lib/router-gateway':'export const routerCall=async body=>{globalThis.sellerAssistantPrompt=body;if(globalThis.sellerReview){return {choices:[{message:{content:JSON.stringify(globalThis.sellerReview)}}]};}return {choices:[{message:{content:JSON.stringify({reply:"Предлагаю текст по вашим словам. Проверьте его.",suggestion:{name:"Детский велосипед",description:"Детский велосипед в хорошем состоянии.",category:"Велосипеды",price:123456,condition:"new",phone:"выдуманный"}})}}]};};',
 '@/lib/connection-notify':'export const notifyConnectionRequest=async()=>"unconfigured";export const sendConnectionReply=async()=>false;',
 '@/lib/product-draft-provider':'export const productDraftProvider=()=>({fromDescription:async()=>({draft:{name:"Гаечные ключи из описания",category:"Дом и ремонт"},questions:[],verified:false,needsSeller:["price","quantity"]})});',
};
await build({stdin:{contents:"import * as connect from './app/api/connect/route';import * as catalog from './app/api/catalog/route';import * as listings from './app/api/listings/route';import * as drafts from './app/api/listings/draft/route';import * as assistant from './app/api/listings/assist/route';import * as devSession from './app/api/dev/seller-session/route';import * as admin from './app/api/onboarding/route';import * as photos from './app/api/photos/[id]/route';export {connect,catalog,admin,photos,listings,drafts,assistant,devSession};export {runSearch} from './lib/search-engine';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',external:['jimp','image-size'],outfile:output+'/bundle.mjs',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));}}]});
const api=await import(pathToFileURL(path.resolve(output+'/bundle.mjs'))),base='https://seller.test';
async function session(provider,subject){const id=provider+':'+subject,raw=randomBytes(32).toString('hex');await sqlite.prepare('INSERT INTO buyer_accounts(id,provider,subject,name,created_at) VALUES(?,?,?,?,?)').run(id,provider,subject,'Fixture '+subject,Date.now());await sqlite.prepare('INSERT INTO buyer_sessions(hash,buyer_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(raw).digest('hex'),id,Date.now()+600000);return 'ng_buyer='+raw;}
const tg=await session('telegram','one'),max=await session('max','two'),yandex=await session('yandex','three'),vk=await session('vk','four');
const req=(url,body,cookie='',method='POST')=>new Request(base+url,{method,headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
async function call(module,body,cookie='',status=200,url='/api/connect',method='POST'){const response=await module[method](req(url,body,cookie,method));const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
const passed=[];const pass=text=>{passed.push(text);console.log('PASS',text);};
const shop={name:'QA магазин',city:'Казань',category:'Дом и ремонт',street:'Тестовая улица, 12',phone:'+7 843 000-00-00',lat:55.8,lng:49.1,site:'',photos:[]};
await call(api.connect,{action:'saveStore',data:shop},'',401);
await call(api.connect,{action:'saveStore',data:shop},yandex,401);
await call(api.connect,{action:'saveStore',data:{...shop,lat:null,lng:null}},tg,400);pass('Only a validated Telegram/MAX session can create a store; map point is mandatory');
await call(api.connect,{action:'saveStore',data:shop},vk,401);
const first=await call(api.connect,{action:'saveStore',data:shop},tg);
assert.equal((await sqlite.prepare('SELECT owner FROM shops WHERE id=?').get(first.id)).owner,'telegram:one');
await call(api.connect,{action:'saveStore',data:{...shop,name:'Second'}},tg,409);
const race=await Promise.all([1,2,3].map(i=>api.connect.POST(req('/api/connect',{action:'saveStore',data:{...shop,name:'MAX '+i}},max))));
assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===409).length,2);
assert.equal((await sqlite.prepare('SELECT COUNT(*) n FROM shops WHERE owner=?').get('max:two')).n,1);pass('One store per account, including simultaneous requests; another account has its own store');
await call(api.connect,undefined,max,404,'/api/connect?draft='+first.id,'GET');
const anotherBrowser=await call(api.connect,undefined,tg,200,'/api/connect?drafts=1','GET');assert.equal(anotherBrowser.drafts[0].id,first.id);pass('Store is restored from account in another browser; a different account cannot access it');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const upload=await api.catalog.PUT(new Request(base+'/api/catalog',{method:'PUT',headers:{Origin:base,Cookie:tg,'Content-Type':'image/png'},body:png}));assert.equal(upload.status,200);const photo=(await upload.json()).url;
const photoReq=cookie=>api.photos.GET(new Request(base+photo,{headers:{Cookie:cookie}}),{params:Promise.resolve({id:photo.split('/').at(-1)})});
assert.equal((await photoReq('')).status,404);assert.equal((await photoReq(tg)).status,200);assert.equal((await photoReq(max)).status,404);pass('Photos save under the social account and remain private until publication');
const product={storeId:first.id,name:'Гаечные ключи',category:'Дом и ремонт',brand:'',model:'',description:'Набор гаечных ключей',features:'',price:1200,priceConfirmed:true,quantity:3,stockConfirmed:true,sku:'fixture',published:false,photos:[photo],keywords:'ключи'};
const created=await call(api.catalog,{action:'product',data:product},tg,200,'/api/catalog');
await call(api.catalog,{action:'product',data:product},max,400,'/api/catalog');
await call(api.catalog,{action:'product',data:product},'',401,'/api/catalog');
const ai=await call(api.catalog,{action:'productDraft',storeId:first.id,description:'гаечные ключи'},tg,200,'/api/catalog');assert.equal(ai.draft.name,'Гаечные ключи из описания');assert.equal((await sqlite.prepare('SELECT COUNT(*) n FROM products WHERE store_id=?').get(first.id)).n,1);pass('Manual card persists; AI is a draft until seller confirmation; foreign/anonymous writes are rejected');
assert.equal((await api.runSearch({query:'ключи',city:'Казань'})).hits.length,0);
await call(api.connect,{action:'submitDraft',storeId:first.id,consent:false},tg,400);
const submitted=await call(api.connect,{action:'submitDraft',storeId:first.id,consent:true},tg);
const again=await call(api.connect,{action:'submitDraft',storeId:first.id,consent:true},tg);assert.equal(again.id,submitted.id);
assert.equal((await sqlite.prepare('SELECT visibility FROM shops WHERE id=?').get(first.id)).visibility,'draft');pass('Explicit consent submits exactly one request; store and products stay out of public search');
globalThis.sellerAdmin=true;
await call(api.admin,{action:'publish',id:first.id,consent:'Адрес и контакт представителя проверены вручную'},'',200,'/api/onboarding');
globalThis.sellerAdmin=false;
const result=await api.runSearch({query:'ключи',city:'Казань',near:{lat:55.801,lng:49.101}}),hit=result.hits.find(h=>h.product?.id===created.id);
assert.ok(hit);assert.equal(hit.price,1200);assert.deepEqual(hit.point,{lat:55.8,lng:49.1});assert.ok(hit.distanceKm>0);assert.equal(hit.sourceAvailability,'in_stock');assert.equal((await photoReq('')).status,200);pass('After manual approval, the exact owner product appears in nearby search with store coordinates, distance, price and photo');
await call(api.catalog,{action:'product',id:created.id,data:{...product,published:true,price:900,quantity:2}},tg,200,'/api/catalog');
const updated=await api.runSearch({query:'ключи',city:'Казань'});assert.equal(updated.hits.find(h=>h.product?.id===created.id).price,900);pass('Owner edits refresh the product in search');
await call(api.catalog,{action:'shop',data:shop},tg,400,'/api/catalog');
await call(api.connect,{action:'saveStore',data:{...shop,id:first.id,street:'Другой адрес, 15',lat:55.81}},tg);assert.equal((await api.runSearch({query:'ключи',city:'Казань'})).hits.length,0);
await call(api.connect,{action:'saveStore',data:shop},tg,409);
await assert.rejects(async()=>sqlite.prepare("INSERT INTO shops(id,owner,data,visibility) VALUES('bypass','telegram:one','{}','draft')").run(),/UNIQUE|unique/i);pass('Profile/address changes return to review; hiding a store does not allow a second organization; database blocks bypass');
// Product-first private seller: no business name or six-category gate.
const privateCookie=await session('telegram','private');
const privateUpload=await api.catalog.PUT(new Request(base+'/api/catalog',{method:'PUT',headers:{Origin:base,Cookie:privateCookie,'Content-Type':'image/png'},body:png}));assert.equal(privateUpload.status,200);const privatePhoto=(await privateUpload.json()).url;
const listing={id:crypto.randomUUID(),name:'Детский велосипед',description:'Свой велосипед, в хорошем состоянии',category:'Велосипеды',condition:'used',price:5500,photos:[privatePhoto],city:'Казань',street:'Место встречи, 10',lat:55.8,lng:49.1,phone:'+7 900 000-00-00',consent:true};
await call(api.listings,listing,'',401,'/api/listings');await call(api.listings,{...listing,consent:false},privateCookie,400,'/api/listings');await call(api.listings,{...listing,photos:[photo]},privateCookie,400,'/api/listings');
const draftData={...listing,price:'5500',priceMode:'fixed',point:{label:listing.street,lat:listing.lat,lng:listing.lng}};delete draftData.lat;delete draftData.lng;delete draftData.consent;
await call(api.drafts,undefined,'',401,'/api/listings/draft','GET');
const draftSaved=await call(api.drafts,{draft:draftData,version:0},privateCookie,200,'/api/listings/draft','PUT');assert.equal(draftSaved.version,1);
const ownDraft=await call(api.drafts,undefined,privateCookie,200,'/api/listings/draft','GET');assert.equal(ownDraft.draft.name,listing.name);
const foreignDraft=await call(api.drafts,undefined,max,200,'/api/listings/draft','GET');assert.equal(foreignDraft.draft,null);
await call(api.drafts,{draft:{...draftData,name:'Устаревшая вкладка'},version:0},privateCookie,409,'/api/listings/draft','PUT');
assert.equal((await call(api.drafts,undefined,privateCookie,200,'/api/listings/draft','GET')).draft.name,listing.name);
const posted=await call(api.listings,listing,privateCookie,200,'/api/listings');
assert.equal((await call(api.drafts,undefined,privateCookie,200,'/api/listings/draft','GET')).draft,null);
const savedPrivate=await call(api.connect,undefined,privateCookie,200,'/api/connect?draft='+posted.storeId,'GET');assert.equal(savedPrivate.shop.sellerType,'private');assert.equal(savedPrivate.products[0].condition,'used');assert.equal(savedPrivate.products[0].published,false);
await call(api.drafts,{draft:draftData,version:0},privateCookie,200,'/api/listings/draft','PUT');
const repeated=await call(api.listings,listing,privateCookie,200,'/api/listings');assert.equal(repeated.alreadySaved,true);assert.equal((await call(api.drafts,undefined,privateCookie,200,'/api/listings/draft','GET')).draft,null);
assert.equal((await sqlite.prepare('SELECT COUNT(*) n FROM products WHERE store_id=?').get(posted.storeId)).n,1);
await call(api.listings,listing,max,403,'/api/listings');
globalThis.sellerAdmin=true;await call(api.admin,{action:'publish',id:posted.storeId,consent:'Продавец подтвердил объявление и место передачи'},'',200,'/api/onboarding');globalThis.sellerAdmin=false;
const usedResults=await api.runSearch({query:'велосипед',city:'Казань',near:{lat:55.801,lng:49.101}}),privateHit=usedResults.hits.find(h=>h.product?.id===listing.id);assert.ok(privateHit);assert.equal(privateHit.product.condition,'used');assert.equal(privateHit.shop.sellerType,'private');assert.ok(privateHit.distanceKm>0);
const onlyNew=await api.runSearch({query:'велосипед',city:'Казань',context:{query:'велосипед',newOnly:true},resume:true});assert.equal(onlyNew.hits.some(h=>h.product?.id===listing.id),false);
const second=await call(api.listings,{...listing,id:crypto.randomUUID(),name:'Велосипед новый',condition:'new'},privateCookie,200,'/api/listings');assert.equal(second.storeId,posted.storeId);assert.equal((await sqlite.prepare('SELECT COUNT(*) n FROM shops WHERE owner=?').get('telegram:private')).n,1);
await call(api.catalog,{action:'product',id:listing.id,data:{...savedPrivate.products[0],published:false,quantity:0,stockConfirmed:true}},privateCookie,200,'/api/catalog');globalThis.sellerAdmin=true;await call(api.admin,{action:'publish',id:posted.storeId,consent:'Проверены новые активные объявления продавца'},'',200,'/api/onboarding');globalThis.sellerAdmin=false;
const afterReview=await api.runSearch({query:'велосипед',city:'Казань'});assert.equal(afterReview.hits.some(h=>h.product?.id===listing.id),false);assert.ok(afterReview.hits.some(h=>h.product?.id===second.id));
const negotiable=await call(api.listings,{...listing,id:crypto.randomUUID(),name:'Велосипед с договорной ценой',price:null,priceMode:'negotiable'},privateCookie,200,'/api/listings');const negotiated=await call(api.connect,undefined,privateCookie,200,'/api/connect?draft='+negotiable.storeId,'GET');assert.equal(negotiated.products.find(p=>p.id===negotiable.id).price,null);
await call(api.listings,{...listing,id:crypto.randomUUID(),price:null},privateCookie,400,'/api/listings');
// The same product-first command creates a business and edits listings without duplication.
const companyCookie=await session('max','unified-company');
const companyUpload=await api.catalog.PUT(new Request(base+'/api/catalog',{method:'PUT',headers:{Origin:base,Cookie:companyCookie,'Content-Type':'image/png'},body:png}));assert.equal(companyUpload.status,200);const companyPhoto=(await companyUpload.json()).url;
const companyListing={...listing,id:crypto.randomUUID(),name:'Велосипед магазина',sellerType:'business',companyName:'Веломагазин рядом',photos:[companyPhoto]};
await call(api.listings,{...companyListing,companyName:''},companyCookie,400,'/api/listings');
const companyPosted=await call(api.listings,companyListing,companyCookie,200,'/api/listings');
let companyState=await call(api.connect,undefined,companyCookie,200,'/api/connect?draft='+companyPosted.storeId,'GET');assert.equal(companyState.shop.sellerType,'business');assert.equal(companyState.shop.name,'Веломагазин рядом');assert.equal(companyState.products.length,1);
await call(api.listings,{...companyListing,id:crypto.randomUUID(),name:'Другой велосипед магазина'},companyCookie,200,'/api/listings');assert.equal((await sqlite.prepare('SELECT COUNT(*) n FROM shops WHERE owner=?').get('max:unified-company')).n,1);
await call(api.listings,companyListing,privateCookie,403,'/api/listings','PUT');await call(api.listings,{...companyListing,id:crypto.randomUUID()},companyCookie,404,'/api/listings','PUT');
globalThis.sellerAdmin=true;await call(api.admin,{action:'publish',id:companyPosted.storeId,consent:'Магазин подтвердил товар и точку'},'',200,'/api/onboarding');globalThis.sellerAdmin=false;
const changedCompany={...companyListing,name:'Велосипед магазина обновлён',companyName:'Вело рядом',price:6100,street:'Новое место, 20',lat:55.81};
await call(api.listings,changedCompany,companyCookie,200,'/api/listings','PUT');
companyState=await call(api.connect,undefined,companyCookie,200,'/api/connect?draft='+companyPosted.storeId,'GET');assert.equal(companyState.products.length,2);assert.equal(companyState.products.find(p=>p.id===companyListing.id).price,6100);assert.equal(companyState.shop.name,'Вело рядом');assert.equal(companyState.shop.street,'Новое место, 20');assert.equal(companyState.shop.visibility,'draft');
assert.equal((await api.runSearch({query:'велосипед',city:'Казань'})).hits.some(h=>h.product?.id===companyListing.id),false);
globalThis.sellerAdmin=true;await call(api.admin,{action:'publish',id:companyPosted.storeId,consent:'Новая точка и изменения карточки проверены'},'',200,'/api/onboarding');globalThis.sellerAdmin=false;
const companyHit=(await api.runSearch({query:'велосипед',city:'Казань',near:{lat:55.8,lng:49.1}})).hits.find(h=>h.product?.id===companyListing.id);assert.equal(companyHit.price,6100);assert.equal(companyHit.point.lat,55.81);assert.equal(companyHit.shop.name,'Вело рядом');
await call(api.catalog,{action:'product',id:companyListing.id,data:{...companyState.products.find(p=>p.id===companyListing.id),published:false,quantity:0,stockConfirmed:true}},companyCookie,200,'/api/catalog');
globalThis.sellerAdmin=true;await call(api.admin,{action:'publish',id:companyPosted.storeId,consent:'Проверен второй активный товар магазина'},'',200,'/api/onboarding');globalThis.sellerAdmin=false;
assert.equal((await api.runSearch({query:'велосипед',city:'Казань'})).hits.some(h=>h.product?.id===companyListing.id),false);
pass('Unified private/company listing command: auto profile, one point, owner-only edit without duplicate product, profile review and map coordinates; withdrawn company items stay hidden');

globalThis.sellerEnv.ROUTERAI_API_KEY='fixture';
const assistBody={message:'Продаю велосипед б/у за 5500 рублей',current:{name:'',description:'',category:'Личные вещи'},history:[]};
await call(api.assistant,assistBody,'',401,'/api/listings/assist');const suggestion=await call(api.assistant,assistBody,privateCookie,200,'/api/listings/assist');assert.equal(suggestion.mode,'ai');assert.equal(suggestion.suggestion.price,5500);assert.equal(suggestion.suggestion.condition,'used');assert.equal(suggestion.suggestion.phone,undefined);assert.ok(!JSON.stringify(globalThis.sellerAssistantPrompt).includes(listing.phone));
const noFacts=await call(api.assistant,{...assistBody,message:'Помоги описать велосипед'},privateCookie,200,'/api/listings/assist');assert.equal(noFacts.suggestion.price,undefined);assert.equal(noFacts.suggestion.condition,undefined);
const photoSuggestion=await call(api.assistant,{...assistBody,message:'Подготовь карточку по фото',image:'data:image/jpeg;base64,YWJj'},privateCookie,200,'/api/listings/assist');assert.equal(photoSuggestion.suggestion.price,undefined);assert.equal(photoSuggestion.suggestion.condition,undefined);assert.equal(globalThis.sellerAssistantPrompt.model,globalThis.sellerEnv.ROUTERAI_VISION_MODEL||'qwen/qwen3-vl-30b-a3b-instruct');assert.equal(globalThis.sellerAssistantPrompt.messages[1].content[1].type,'image_url');assert.ok(!JSON.stringify(globalThis.sellerAssistantPrompt).includes(listing.phone));
const autoCookie=await session('telegram','auto-review');
const {Jimp}=await import('jimp');
const reviewPhoto=await new Jimp({width:40,height:40,color:0xffffffff}).getBuffer('image/png');
const autoUpload=await api.catalog.PUT(new Request(base+'/api/catalog',{method:'PUT',headers:{Origin:base,Cookie:autoCookie,'Content-Type':'image/png'},body:reviewPhoto}));
const autoListing={...listing,id:crypto.randomUUID(),photos:[(await autoUpload.json()).url]};
globalThis.sellerReview={status:'blocked',reason:'weapons'};
await call(api.listings,autoListing,autoCookie,422,'/api/listings');
assert.equal((await sqlite.prepare('SELECT count(*) AS n FROM products WHERE id=?').get(autoListing.id)).n,0);
globalThis.sellerReview={status:'approved'};
const autoPosted=await call(api.listings,autoListing,autoCookie,200,'/api/listings');
assert.equal(autoPosted.status,'published');
assert.equal((await sqlite.prepare('SELECT visibility FROM shops WHERE id=?').get(autoPosted.storeId)).visibility,'public');
assert.equal((await sqlite.prepare('SELECT published FROM products WHERE id=?').get(autoListing.id)).published,1);
assert.equal((await call(api.listings,autoListing,autoCookie,200,'/api/listings')).status,'published');
globalThis.sellerReview={status:'unknown'};
assert.equal((await call(api.listings,{...autoListing,id:crypto.randomUUID()},autoCookie,200,'/api/listings')).status,'pending');
delete globalThis.sellerReview;
pass('Automatic review publishes approved items once, blocks prohibited items and keeps invalid decisions pending');
delete globalThis.sellerEnv.ROUTERAI_API_KEY;const fallback=await call(api.assistant,assistBody,privateCookie,200,'/api/listings/assist');assert.equal(fallback.mode,'guide');
const beforeNodeEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';const forbiddenDemo=await api.devSession.POST(new Request('https://seller.test/api/dev/seller-session',{method:'POST',headers:{Origin:'https://seller.test'}}));assert.equal(forbiddenDemo.status,404);if(beforeNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=beforeNodeEnv;
pass('Account drafts are isolated, versioned and cleared on submit; negotiable price is nullable; assistant cannot invent price/condition or publish; demo login is disabled in production');
pass('Private listings save without business setup; photo ownership, consent, idempotency, new/used, nearby search and one seller point enforced');
writeFileSync(output+'/report.json',JSON.stringify({passed,realMessengerTest:false,fixture:(usePostgres?'native PostgreSQL isolated schema':'in-memory SQLite')+'; valid synthetic buyer sessions; AI and transport simulated'},null,2));

}finally{if(pgPool){await pgPool.end();await control.query('DROP SCHEMA '+schema+' CASCADE');await control.end();}else sqlite.close();}
