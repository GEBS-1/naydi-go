import assert from 'node:assert/strict';
import {emptyPersonal,readPersonal,updatePersonal,toggleFavorite,rememberSearch,replaySearch,takeReplay,personalSchema,keepPlan} from '../lib/personal.ts';
class Storage{values=new Map();getItem(k){return this.values.get(k)||null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
globalThis.localStorage=new Storage();globalThis.sessionStorage=new Storage();globalThis.window=new EventTarget();globalThis.location={hash:''};
assert.deepEqual(readPersonal(),emptyPersonal());
const item={id:'test-product',title:'Unit fixture',kind:'product',url:'https://example.org/item',city:'Москва',price:100};
toggleFavorite(item);assert.equal(readPersonal().favorites.length,1);toggleFavorite(item);assert.equal(readPersonal().favorites.length,0);
assert.equal(personalSchema.safeParse({...emptyPersonal(),favorites:[{...item,url:'javascript:alert(1)'}]}).success,false);
rememberSearch({query:'дрель',city:'Москва',filter:'product',context:{query:'дрель',maxPrice:5000,sort:'price',newOnly:true}},true);
const saved=readPersonal().searches[0];replaySearch(saved);assert.equal(localStorage.getItem('ng_city'),'Москва');assert.deepEqual(takeReplay(),saved);assert.equal(takeReplay(),null);
rememberSearch({query:'дрель',city:'Москва',filter:'all'});rememberSearch({query:'дрель',city:'Москва',filter:'all'});assert.equal(readPersonal().history.length,1);
updatePersonal(p=>({...p,history:[]}));assert.equal(readPersonal().searches.length,1);
keepPlan({id:'unit-plan',title:'Список',city:'Москва',task:'',items:[],questions:[],ai:false,updatedAt:new Date().toISOString()});keepPlan({...readPersonal().collections[0],title:'Переименован'});assert.equal(readPersonal().collections.length,1);assert.equal(readPersonal().collections[0].title,'Переименован');
const before=readPersonal();localStorage.setItem=()=>{throw Error('QuotaExceeded');};assert.throws(()=>toggleFavorite(item),/хранилище/);assert.deepEqual(readPersonal(),before);
console.log('PASS: favorites toggle, unsafe URL rejection, city/filters/context replay, one-shot replay, history dedup/clear, plan rename, storage failure preserves data. Unit fixtures only; no network responses mocked.');
