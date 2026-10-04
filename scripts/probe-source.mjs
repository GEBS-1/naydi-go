import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const {fetchSource,allowedSource,robotsAllowed}=await import(compile(await readFile('lib/source-fetch.ts','utf8')));
const url=process.argv[2];if(!allowedSource(url))throw Error('Source is not reviewed / allowlisted');
const robots=await fetch(new URL('/robots.txt',url),{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)'}});
console.log(JSON.stringify({robots:robots.status,allowed:robots.status===404||robots.ok&&robotsAllowed(await robots.text(),new URL(url).pathname+new URL(url).search)}));
const html=await fetchSource(url);if(!html){console.log('Source blocked, unavailable, redirected, or opted out. No bypass.');process.exit(0);}
const micro=compile(await readFile('lib/microdata.ts','utf8')),city=await readFile('lib/city-search.ts','utf8');
const code=(await readFile('lib/offer-extraction.ts','utf8')).replace(/import .* from '\.\/city-search';/,city.split('\n').find(l=>l.startsWith('export function safeHTTP'))).replace("'./microdata'",JSON.stringify(micro));
const {extractOffers}=await import(compile(code.replace("'./seller-adapters'",JSON.stringify(compile(await readFile('lib/seller-adapters.ts','utf8'))))));
const offers=extractOffers(html,url,'Казань');
await mkdir('artifacts/source-diagnostics',{recursive:true});await writeFile('artifacts/source-diagnostics/'+new URL(url).hostname+'.json',JSON.stringify({url,size:html.length,offers},null,2));
if(process.argv.includes('--html'))await writeFile('artifacts/source-diagnostics/'+new URL(url).hostname+'.html',html);
console.log(JSON.stringify({size:html.length,offers:offers.length,examples:offers.slice(0,3).map(h=>({title:h.title,price:h.price,site:h.site}))}));
