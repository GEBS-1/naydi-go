import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const read=name=>readFile(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');
const adapters=compile((await read('seller-adapters')).replace("import type {SearchHit} from './city-search';",''));
const micro=compile(await read('microdata'));
const city=await read('city-search'),safe=city.split('\n').find(line=>line.startsWith('export function safeHTTP'));
const extraction=(await read('offer-extraction')).replace(/import .* from '\.\/city-search';/,safe).replace("'./microdata'",JSON.stringify(micro)).replace("'./seller-adapters'",JSON.stringify(adapters));
const {extractOffers}=await import(compile(extraction));
const urls=process.argv.slice(2);
if(!urls.length)throw Error('Pass reviewed seller URLs');
for(const url of urls){
 const response=await fetch(url,{headers:{'User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)',Accept:'text/html'}});
 const html=await response.text(),offers=extractOffers(html,url,'Казань');
 console.log(JSON.stringify({url,http:response.status,bytes:Buffer.byteLength(html),offers:offers.length,priced:offers.filter(x=>x.price!==null).length,imaged:offers.filter(x=>x.image).length,sample:offers.slice(0,2).map(x=>({title:x.title,price:x.price,site:x.site}))}));
}
