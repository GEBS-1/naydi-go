import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {dirname,join,basename} from 'node:path';

const root=process.cwd();
const manifest=await readFile(join(root,'dist/server/__vite_rsc_assets_manifest.js'),'utf8');
const references=[...new Set([...manifest.matchAll(/"(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(m=>m[1]))];
const cssFiles=await readdir(join(root,'dist/client/_next/static/css'));
const repaired=[];
for(const reference of references){
 const target=join(root,'dist/client',...reference.split('/').filter(Boolean));
 try{await readFile(target);continue;}catch{/* validate below */}
 const logical=basename(reference).replace(/-[A-Za-z0-9_-]+\.js$/, '');
 // Vinext beta can list CSS-only client references as JavaScript preloads.
 // Repair only when an extracted stylesheet with the same logical name exists.
 if(!cssFiles.some(name=>name.startsWith(logical+'.')&&name.endsWith('.css'))){
  throw new Error(`Build manifest references missing non-CSS chunk: ${reference}`);
 }
 await mkdir(dirname(target),{recursive:true});
 await writeFile(target,'// CSS-only Vinext client reference.\nexport {};\n','utf8');
 repaired.push(reference);
}
console.log(repaired.length?`Vinext manifest repair: ${repaired.length} CSS-only chunks created.`:'Vinext manifest check: all client chunks exist.');
