import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const buildResult=await build({entryPoints:['lib/nearby-topics.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22'});
const {searchZone,searchIdentity}=await import('data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0].text).toString('base64'));
const near={lat:55.830123,lng:49.100456},zone=searchZone(near);
assert.ok(!zone.includes('55.830123'));
assert.equal(searchIdentity('Гаечные ключи','Казань',near),searchIdentity('гаечные   ключи','казань',{lat:55.830124,lng:49.100457}));
assert.notEqual(searchIdentity('Гаечные ключи','Казань',near),searchIdentity('Гаечные ключи','Самара',near));
const entries=new Map();
globalThis.nearbyTest={
 hash:async value=>createHash('sha256').update(value).digest('hex'),
 cacheWrite:async(key,data,ttl)=>entries.set(key,{data:JSON.stringify(data),expires:Date.now()+ttl}),
 db:()=>({prepare:()=>({bind:(prefix,end,now)=>({all:async()=>({results:[...entries].filter(([key,value])=>key>=prefix&&key<end&&value.expires>now).map(([,value])=>({data:value.data}))})})})}),
};
const topicModule='data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0].text).toString('base64');
const source=(await readFile('lib/nearby-searches.ts','utf8')).replace("import {db} from '@/db';","const {db}=globalThis.nearbyTest;").replace("import {hash} from './onboarding';","const {hash}=globalThis.nearbyTest;").replace("import {cacheWrite} from './search-storage';","const {cacheWrite}=globalThis.nearbyTest;").replace("import {cityKey} from './location';","const cityKey=value=>value.toLowerCase();").replace("'./nearby-topics'",JSON.stringify(topicModule));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {rememberSearchIndex}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const result={context:{query:'детская раскраска с машинками Тачки'},hits:[{id:'one'}],searchArea:{city:'Казань',zone}};
const key=await rememberSearchIndex(result,'Самара',undefined);
assert.match(key,/^[a-f0-9]{64}$/);
assert.equal(await rememberSearchIndex(result,'Самара',undefined),key);
assert.equal(entries.size,1);
assert.ok(!JSON.stringify([...entries]).includes('раскраска'));
const retired=await build({entryPoints:['app/api/search/nearby/route.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(retired.outputFiles[0].text).toString('base64'));
assert.deepEqual(await POST().json(),{items:[]});
console.log('PASS stable search key without recording or exposing shared query suggestions');
