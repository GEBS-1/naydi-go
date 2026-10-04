import {writeFile,mkdir} from 'node:fs/promises';
// CC0: https://commons.wikimedia.org/wiki/File:My_Red_magic_mug.JPG
// Author: Michibeckmichal. Test input only, never advertised as a store's product photo.
const url='https://upload.wikimedia.org/wikipedia/commons/4/49/My_Red_magic_mug.JPG';
const r=await fetch(url,{headers:{'User-Agent':'NaydiGo QA/1.0'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Photo HTTP '+r.status);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>4e6)throw Error('Unexpected size');await mkdir('artifacts/mvp-final',{recursive:true});await writeFile('artifacts/mvp-final/cc0-red-mug.jpg',bytes);console.log('Saved CC0 test photo:',bytes.length,'bytes');
