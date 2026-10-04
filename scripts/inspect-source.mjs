import {readFile} from 'node:fs/promises';
const text=await readFile('artifacts/mvp-final/source.txt','utf8');
for(const term of ['price','product:price','application/ld','itemprop','__NEXT_DATA__','VARTA Blue']){const hits=[...text.matchAll(new RegExp(term,'gi'))].slice(0,8);console.log(term, hits.map(h=>text.slice(Math.max(0,h.index-90),h.index+250)));}
