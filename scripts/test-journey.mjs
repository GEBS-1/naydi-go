import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function moduleAt(path){const source=await readFile(new URL(path,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const {eligibleShop,distanceToPath,detourSeconds,viaLink}=await moduleAt('../lib/journey.ts');
const {rankSearch}=await moduleAt('../lib/search.ts');
const shop={id:'qa-only',visibility:'public',demo:false,addressConfirmed:true,street:'Баумана, 20',lat:55.791,lng:49.115};
assert(eligibleShop(shop));for(const change of [{visibility:'draft'},{demo:true},{addressConfirmed:false},{lat:null},{lng:NaN},{street:''}])assert(!eligibleShop({...shop,...change}));
assert.equal(detourSeconds({seconds:600},{seconds:840}),240);assert.throws(()=>detourSeconds({seconds:600},{seconds:NaN}));
assert(distanceToPath({lat:55.8,lng:49.1},[{lat:55.7,lng:49.1},{lat:55.9,lng:49.1}])<1);
const link=new URL(viaLink({lat:55.8,lng:49.1},shop,{lat:55.9,lng:49.2},'pedestrian'));assert.equal(link.searchParams.get('rtt'),'pd');assert.equal(link.searchParams.get('rtext'),'55.8,49.1~55.791,49.115~55.9,49.2');
const fixtures=[{id:'1',name:'Компрессор автомобильный',category:'Автотовары',features:'12 В',description:'Насос для шин',keywords:'насос',brand:'',model:''},{id:'2',name:'Наушники Bluetooth',category:'Электроника',features:'Беспроводные',description:'Гарнитура',keywords:'',brand:'',model:''},{id:'3',name:'Смеситель для ванной',category:'Сантехника',features:'Латунь',description:'',keywords:'',brand:'',model:''}];
for(const [q,id] of [['насос для машины','1'],['bluetooth','2'],['смесит','3']])assert.equal(rankSearch(fixtures,q)[0].id,id);assert.equal(rankSearch(fixtures,'телепорт').length,0);
console.log('PASS: eligibility, private/demo exclusion, geometric shortlist, routed duration, via destination, three product queries. No DB writes.');
