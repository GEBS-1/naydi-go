import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const env={...parseEnv(readFileSync('.env','utf8')),...parseEnv(readFileSync('.env.local','utf8'))};
const report={};
for(const provider of ['telegram','max']){
 const key=env[provider==='telegram'?'TELEGRAM_BOT_TOKEN':'MAX_BOT_TOKEN'];
 if(!key){report[provider]={configured:false};continue;}
 try{const r=await fetch(provider==='telegram'?`https://api.telegram.org/bot${key}/getMe`:'https://platform-api.max.ru/me',{headers:provider==='max'?{Authorization:key}:{},signal:AbortSignal.timeout(15000)});const b=await r.json();const bot=provider==='telegram'?b.result:b;report[provider]={http:r.status,ok:r.ok&&b.ok!==false,id:bot?.id??bot?.user_id,name:bot?.first_name??bot?.name,username:bot?.username};}catch{report[provider]={error:'Network or TLS failure; credential not printed'};}
}
mkdirSync('artifacts/buyer',{recursive:true});writeFileSync('artifacts/buyer/providers.json',JSON.stringify(report,null,2));console.log(report);
