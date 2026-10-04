import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';

const env=parseEnv(readFileSync('.env.local','utf8'));
const key=process.env.ROUTERAI_API_KEY||env.ROUTERAI_API_KEY;
if(!key)throw Error('ROUTERAI_API_KEY missing');
const query=process.argv.slice(2).join(' ')||'свечной ключ или свечная головка для Toyota RAV4 2017';
const response=await fetch('https://routerai.ru/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'perplexity/sonar',max_tokens:900,temperature:0.1,messages:[{role:'system',content:'Найди конкретные карточки товаров у продавцов в Казани. Не возвращай статьи, инструкции, обзоры, форумы или видео. Используй ссылки на первоисточники и не выдумывай цену или наличие.'},{role:'user',content:query}]}),signal:AbortSignal.timeout(45000)});
const body=await response.json();
const safe={at:new Date().toISOString(),http:response.status,id:body.id||null,search_results:body.search_results||[],citations:body.citations||[],annotations:body.choices?.[0]?.message?.annotations||[],usage:body.usage||null};
mkdirSync('artifacts/router-probe',{recursive:true});
writeFileSync('artifacts/router-probe/sonar-sources.json',JSON.stringify(safe,null,2));
console.log(JSON.stringify({http:safe.http,searchResults:safe.search_results.length,citations:safe.citations.length,annotations:safe.annotations.length,usage:safe.usage},null,2));
