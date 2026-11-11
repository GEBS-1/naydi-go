import {recordUsage,currentUsage} from './search-usage';
import {env} from '@/lib/server-env';
import {reserveCall,finishCall} from './api-budget';
import {cacheRead,cacheWrite} from './search-storage';
export type RouterAnswer={id?:string;model?:string;usage?:{prompt_tokens?:number;completion_tokens?:number;input_tokens?:number;output_tokens?:number};choices?:{finish_reason:string;message:{content:string;annotations?:{type:string;url_citation?:{url:string;title?:string;content?:string}}[]}}[];citations?:string[];search_results?:{url:string;title:string;snippet?:string}[];answers?:Record<string,unknown>};
export async function routerTranscribe(audio:string,durationSeconds:number):Promise<{text:string}>{
 if(!env.ROUTERAI_API_KEY)throw Error('Распознавание речи не настроено. Введите запрос вручную.');
 const model='assemblyai/universal-3-6-pro',call=await reserveCall('routerai',model),started=performance.now();
 const complete=async(status:string,cost:number|null,data:Record<string,unknown>)=>{await finishCall(call,status,cost,{...data,costRub:cost,traceId:currentUsage()?.traceId});recordUsage({provider:'routerai',model,ms:performance.now()-started,costRub:cost,tokens:null,status});};
 let response:Response;
 try{response=await fetch('https://routerai.ru/api/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${env.ROUTERAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input_audio:{data:audio,format:'wav'},language:'ru'}),signal:AbortSignal.timeout(55000)});}
 catch{await complete('unknown',null,{error:'network',durationSeconds});throw Error('RouterAI не ответил. Не запускайте повторно сразу: стоимость вызова требует сверки.');}
 if(!response.ok){const cost=[400,401,403,404,413,422,429].includes(response.status)?0:null;await complete(cost===0?'error':'unknown',cost,{httpStatus:response.status,durationSeconds});throw Error(response.status===401||response.status===403?'RouterAI отклонил ключ распознавания.':'Не удалось распознать запись. Попробуйте ещё раз или введите запрос.');}
 let answer:{id?:string;text?:string;usage?:Record<string,unknown>};
 try{answer=await response.json() as typeof answer;}catch{await complete('unknown',null,{error:'invalid-json',durationSeconds});throw Error('RouterAI вернул некорректный ответ.');}
 const id=answer.id||response.headers.get('x-generation-id');let cost:number|null=null;
 if(id){try{const r=await fetch('https://routerai.ru/api/v1/generation?id='+encodeURIComponent(id),{headers:{Authorization:`Bearer ${env.ROUTERAI_API_KEY}`},signal:AbortSignal.timeout(6000)});if(r.ok){const x=await r.json() as {data?:{total_cost?:number};total_cost?:number};const n=x.data?.total_cost??x.total_cost;if(typeof n==='number'&&n>=0)cost=n;}}catch{}}
 await complete('complete',cost,{generationId:id,durationSeconds,usage:answer.usage||null});
 return {text:typeof answer.text==='string'?answer.text:''};
}
export async function routerCall(body:Record<string,unknown>,endpoint='chat/completions',requestTimeoutMs?:number):Promise<RouterAnswer>{
 if(!env.ROUTERAI_API_KEY)throw Error('RouterAI не настроен.');
 if(await cacheRead('router-auth-failed'))throw Error('RouterAI отклонил ключ (401/403). Проверьте ключ; повторная проверка через 5 минут.');
 const model=String(body.model||env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507');
 const allowed=new Set(['typesafe/jev-1.13','perplexity/sonar','qwen/qwen3-30b-a3b-instruct-2507','qwen/qwen3-vl-8b-instruct','qwen/qwen3-vl-30b-a3b-instruct','qwen/qwen3.6-35b-a3b']);
 if(!allowed.has(model))throw Error('Модель не входит в проверяемый недорогой список MVP.');
 if(!['decisions','chat/completions'].includes(endpoint))throw Error('Недопустимый endpoint.');
 if(endpoint==='chat/completions'&&(typeof body.max_tokens!=='number'||body.max_tokens>3500||body.max_tokens<1))throw Error('Превышен лимит ответа модели.');
 if(JSON.stringify(body).length>1600000)throw Error('Слишком большой запрос к модели.');
 const call=await reserveCall('routerai',model),start=performance.now();
 const complete=async(status:string,cost:number|null,data:Record<string,unknown>)=>{await finishCall(call,status,cost,{...data,costRub:cost,traceId:currentUsage()?.traceId});const usage=data.usage as RouterAnswer['usage'];recordUsage({provider:'routerai',model,ms:performance.now()-start,costRub:cost,tokens:usage?(usage.prompt_tokens??usage.input_tokens??0)+(usage.completion_tokens??usage.output_tokens??0):null,status});};
 let response:Response;
 const timeoutMs=requestTimeoutMs??(/vl|vision|gemini|gpt-4o/i.test(model)?55000:35000);
 try{response=await fetch('https://routerai.ru/api/v1/'+endpoint,{method:'POST',headers:{Authorization:`Bearer ${env.ROUTERAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({...body,model}),signal:AbortSignal.timeout(timeoutMs)});}catch{await complete('unknown',null,{ms:performance.now()-start,error:'network'});throw Error('RouterAI не ответил. Стоимость требует сверки, автоматических повторов нет.');}
 if(!response.ok){const knownFree=[400,401,403,404,422,429].includes(response.status);await complete('error',knownFree?0:null,{ms:performance.now()-start,httpStatus:response.status});if([401,403].includes(response.status))await cacheWrite('router-auth-failed',true,300000);throw Error(`RouterAI: HTTP ${response.status}. Обычный поиск остаётся доступен.`);}
 let answer:RouterAnswer;try{answer=await response.json() as RouterAnswer;}catch{await complete('unknown',null,{error:'invalid-json'});throw Error('Некорректный ответ RouterAI.');}
 // Some upstream failures arrive with HTTP 200. Do not record them as successful calls.
 if(answer&&typeof answer==='object'&&'error' in answer&&answer.error){const status=Number((answer.error as {code?:number}).code)||502;await complete('error',[400,401,403,404,422,429].includes(status)?0:null,{httpStatus:response.status,upstreamStatus:status});throw Error('Модель временно недоступна. Попробуйте позже или заполните карточку вручную.');}
 let cost:number|null=null;
 const id=answer.id||response.headers.get('x-generation-id');
 // RouterAI documents total_cost in RUB on generation, unlike other compatible providers.
 if(id){try{const r=await fetch('https://routerai.ru/api/v1/generation?id='+encodeURIComponent(id),{headers:{Authorization:`Bearer ${env.ROUTERAI_API_KEY}`},signal:AbortSignal.timeout(6000)});if(r.ok){const b=await r.json() as {data?:{total_cost?:number};total_cost?:number};const n=b.data?.total_cost??b.total_cost;if(typeof n==='number'&&n>=0)cost=n;}}catch{}}
 await complete('complete',cost,{generationId:id,ms:performance.now()-start,usage:answer.usage||null});return answer;
}
