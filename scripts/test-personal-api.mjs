import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

const database=new DatabaseSync(':memory:');
database.exec('CREATE TABLE buyer_personal (buyer_id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at INTEGER NOT NULL)');
const wrap=(sql,args=[])=>({bind:(...a)=>wrap(sql,a),first:()=>database.prepare(sql).get(...args)||null,run:()=>({meta:{changes:database.prepare(sql).run(...args).changes}})});
globalThis.personalTestDb={prepare:wrap};
const stubs={
 '@/db':'export const db=()=>globalThis.personalTestDb;',
 '@/lib/buyer-auth':"export const buyerIdentity=async req=>req.headers.get('cookie')?.includes('session=good')?{id:'buyer:fixture'}:null;export const buyerOrigin=req=>{if(req.headers.get('origin')!==new URL(req.url).origin)throw Error('Origin')};",
 '@/lib/discovery-server':"export const quota=async()=>{};export const privateResponse=(data,status=200)=>Response.json(data,{status});",
};
const built=await build({entryPoints:['app/api/buyer/personal/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'personal-fixtures',setup(plugin){plugin.onResolve({filter:/.*/},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'fixtures'}:undefined);plugin.onLoad({filter:/.*/,namespace:'fixtures'},args=>({contents:stubs[args.path],loader:'js'}));}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const base='https://naydigo.prepromo.ru/api/buyer/personal';
const request=(method,body,cookie='session=good')=>new Request(base,{method,headers:{Origin:new URL(base).origin,Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const item={id:'product:fixture',title:'Тестовая карточка',kind:'product',url:'https://example.org/product',city:'Казань'};
const personal={version:1,favorites:[item],searches:[],history:[],collections:[]};
assert.equal((await api.GET(request('GET',null,''))).status,401);
const created=await api.POST(request('POST',personal));assert.equal(created.status,200);assert.equal((await created.json()).version,1);
const withRoute={...item,address:'Казань, улица Декабристов, 160',destination:{lat:55.83,lng:49.08}};
const saved=await api.PUT(request('PUT',{version:1,data:{...personal,favorites:[item, {...withRoute,id:'product:with-route'}]}}));
assert.equal(saved.status,200);
assert.deepEqual((await (await api.GET(request('GET'))).json()).data.favorites,[item,{...withRoute,id:'product:with-route'}]);
const changed=await api.PUT(request('PUT',{version:2,data:{...personal,favorites:[]}}));assert.equal(changed.status,200);assert.equal((await changed.json()).version,3);
const read=await api.GET(request('GET'));assert.deepEqual((await read.json()).data.favorites,[]);
assert.equal((await api.PUT(request('PUT',{version:1,data:personal}))).status,409);
console.log('PASS: authenticated personal data merge, removal, read and version conflict.');
