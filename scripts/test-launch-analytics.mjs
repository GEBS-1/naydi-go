import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../lib/product-events.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const goals=[],requests=[];
globalThis.window={ym:(...args)=>goals.push(args)};
globalThis.location={hostname:'naydigo.prepromo.ru',search:'',pathname:'/'};
Object.defineProperty(globalThis,'navigator',{value:{webdriver:false},configurable:true});
globalThis.fetch=async(url,init)=>{requests.push({url,init});return {ok:true}};
const {trackProductEvent}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
trackProductEvent('phone_click','Казань','Электроника');
await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(goals[0],[113120246,'reachGoal','phone_click',{city:'Казань',category:'Электроника'}]);
assert.equal(requests[0].url,'/api/events');
assert.deepEqual(JSON.parse(requests[0].init.body),{event:'phone_click',city:'Казань',category:'Электроника'});
console.log('PASS: Yandex Metrica goal and internal event use the same verified action name.');
