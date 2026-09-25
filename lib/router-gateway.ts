import {env} from 'cloudflare:workers';
import {reserveCall,finishCall} from './api-budget';
import {cacheRead,cacheWrite} from './search-storage';
export type RouterAnswer={id?:string;model?:string;usage?:{prompt_tokens?:number;completion_tokens?:number;input_tokens?:number;output_tokens?:number};choices?:{finish_reason:string;message:{content:string;annotations?:{type:string;url_citation?:{url:string;title?:string;content?:string}}[]}}[];citations?:string[];search_results?:{url:string;title:string;snippet?:string}[];answers?:Record<string,unknown>};
export async function routerCall(body:Record<string,unknown>,endpoint='chat/completions'):Promise<RouterAnswer>{
 if(!env.ROUTERAI_API_KEY)throw Error('RouterAI не настроен.');
 if(await cacheRead('router-auth-failed'))throw Error('RouterAI отклонил ключ (401/403). Проверьте ключ; повторная проверка через 5 минут.');
 const model=String(body.model||env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507');
 const allowed=new Set(['typesafe/jev-1.13','perplexity/sonar','qwen/qwen3-30b-a3b-instruct-2507','qwen/qwen3-vl-8b-instruct']);
 if(!allowed.has(model))throw Error('Модель не входит в проверяемый недорогой список MVP.');
 if(!['decisions','chat/completions'].includes(endpoint))throw Error('Недопустимый endpoint.');
 if(endpoint==='chat/completions'&&(typeof body.max_tokens!=='number'||body.max_tokens>3500||body.max_tokens<1))throw Error('Превышен лимит ответа модели.');
 if(JSON.stringify(body).length>1600000)throw Error('Слишком большой запрос к модели.');
 const call=await reserveCall('routerai',model),start=performance.now();
 let response:Response;
 try{response=await fetch('https://routerai.ru/api/v1/'+endpoint,{method:'POST',headers:{Authorization:`Bearer ${env.ROUTERAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({...body,model}),signal:AbortSignal.timeout(35000)});}catch{await finishCall(call,'unknown',null,{ms:performance.now()-start,error:'network'});throw Error('RouterAI не ответил. Стоимость требует сверки, автоматических повторов нет.');}
 if(!response.ok){const knownFree=[400,401,403,404,422,429].includes(response.status);await finishCall(call,'error',knownFree?0:null,{ms:performance.now()-start,httpStatus:response.status});if([401,403].includes(response.status))await cacheWrite('router-auth-failed',true,300000);throw Error(`RouterAI: HTTP ${response.status}. Обычный поиск остаётся доступен.`);}
 let answer:RouterAnswer;try{answer=await response.json() as RouterAnswer;}catch{await finishCall(call,'unknown',null,{error:'invalid-json'});throw Error('Некорректный ответ RouterAI.');}
 let cost:number|null=null;
 const id=answer.id||response.headers.get('x-generation-id');
 // RouterAI documents total_cost in RUB on generation, unlike other compatible providers.
 if(id){try{const r=await fetch('https://routerai.ru/api/v1/generation?id='+encodeURIComponent(id),{headers:{Authorization:`Bearer ${env.ROUTERAI_API_KEY}`},signal:AbortSignal.timeout(6000)});if(r.ok){const b=await r.json() as {data?:{total_cost?:number};total_cost?:number};const n=b.data?.total_cost??b.total_cost;if(typeof n==='number'&&n>=0)cost=n;}}catch{}}
 await finishCall(call,'complete',cost,{generationId:id,ms:performance.now()-start,usage:answer.usage||null});return answer;
}
