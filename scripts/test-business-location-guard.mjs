import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['lib/local-business.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22'});
const {businessLocations}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const footer='<title>Ручка синяя — купить в Казани</title><footer>Казань, ул. Юлиуса Фучика, 87</footer>';
assert.equal(businessLocations(footer,'https://seller.example/product/pen-123','Казань').length,0);
assert.equal(businessLocations(footer,'https://seller.example/contacts','Казань').length,1);
console.log('PASS product-page contact footer is not a confirmed selling point; contact page still yields store address.');
