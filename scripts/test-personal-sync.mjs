import assert from 'node:assert/strict';
import {build} from 'esbuild';

const built=await build({entryPoints:['lib/personal.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {emptyPersonal,rebasePersonal}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const item=(id,title=id)=>({id,title,kind:'product',url:'https://example.org/'+id,city:'Казань'});
const base={...emptyPersonal(),favorites:[item('old')]};
const remote={...base,favorites:[item('remote'),item('old')]};
const local={...base,favorites:[item('local')]};
const merged=rebasePersonal(remote,base,local);
assert.deepEqual(merged.favorites.map(f=>f.id),['local','remote'],'a local deletion must not resurrect while a remote addition survives');
const changed=rebasePersonal(remote,base,{...base,favorites:[item('old','Обновлённое название')]});
assert.equal(changed.favorites.find(f=>f.id==='old')?.title,'Обновлённое название');
assert.equal(changed.favorites.some(f=>f.id==='remote'),true);
console.log('PASS: account sync keeps remote additions, local edits and removals.');
