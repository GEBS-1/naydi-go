import assert from 'node:assert/strict';
import {build} from 'esbuild';
const stubs={
 './search-usage':'export const recordUsage=()=>{};export const currentUsage=()=>null;',
 '@/lib/server-env':'export const env={ROUTERAI_API_KEY:"fixture"};',
 './api-budget':'export const reserveCall=async()=>"fixture";export const finishCall=async(...args)=>globalThis.routerFinished.push(args);',
 './search-storage':'export const cacheRead=async()=>null;export const cacheWrite=async()=>{};',
};
const result=await build({entryPoints:['lib/router-gateway.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js'}));}}]});
const {routerCall}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const original=globalThis.fetch;globalThis.routerFinished=[];let requests=0;
try{
 globalThis.fetch=async()=>{requests++;return Response.json({error:{code:503,message:'Temporary upstream limit'}});};
 await assert.rejects(routerCall({model:'qwen/qwen3-vl-30b-a3b-instruct',max_tokens:700}),/временно недоступна/);
 assert.equal(requests,1);assert.equal(globalThis.routerFinished[0][1],'error');assert.equal(globalThis.routerFinished[0][2],null);assert.equal(globalThis.routerFinished[0][3].upstreamStatus,503);
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'ok'}}]});
 const answer=await routerCall({model:'qwen/qwen3-vl-30b-a3b-instruct',max_tokens:700});assert.equal(answer.choices[0].message.content,'ok');assert.equal(globalThis.routerFinished[1][1],'complete');
 console.log('PASS HTTP 200 upstream error is recorded as failure, no automatic retry; successful vision result accepted');
}finally{globalThis.fetch=original;delete globalThis.routerFinished;}
