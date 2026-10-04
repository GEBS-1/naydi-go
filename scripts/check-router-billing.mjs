import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const key=process.env.ROUTERAI_API_KEY||parseEnv(readFileSync('.env.local','utf8')).ROUTERAI_API_KEY;
if(!key)throw Error('ROUTERAI_API_KEY missing');
const r=await fetch('https://routerai.ru/api/v1/credits',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
const b=await r.json();
const report={at:new Date().toISOString(),http:r.status,data:r.ok?b.data:undefined,note:'Read-only balance; aggregate credits do not reconcile the unidentified failed call. No reserve changed.'};
mkdirSync('artifacts/browser-final',{recursive:true});writeFileSync('artifacts/browser-final/billing.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
