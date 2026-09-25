import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/plan-ai.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("from 'zod'",`from '${import.meta.resolve('zod')}'`);
const {generatePlan}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
if(process.argv.includes('--live')){
  process.loadEnvFile('.env.local');
  try{
    const result=await generatePlan({key:process.env.ROUTERAI_API_KEY,model:process.env.ROUTERAI_MODEL},'Нужен рабочий уголок дома: стол, удобное кресло, освещение. Комната небольшая.','Казань',[]);
    assert.ok(result.items.length>0);
    console.log(JSON.stringify({ok:true,model:process.env.ROUTERAI_MODEL,...result},null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}else{
  const valid={title:'Список',questions:[],items:[{category:'Дом',name:'Стол',query:'стол',note:''}]};
  const config={key:'test-not-a-real-key'};
  assert.deepEqual(await generatePlan(config,'тест','Казань',[],async(url,options)=>{
    assert.equal(url,'https://routerai.ru/api/v1/chat/completions');
    const payload=JSON.parse(options.body);assert.equal(payload.max_tokens,3500);assert.equal(payload.response_format.type,'json_schema');
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(valid)}}]});
  }),valid);
  for(const status of [401,402,403,429,500])await assert.rejects(generatePlan(config,'тест','Казань',[],async()=>new Response('secret-provider-body',{status})),e=>!e.message.includes('secret-provider-body'));
  for(const content of ['not json',JSON.stringify({...valid,price:100})])await assert.rejects(generatePlan(config,'тест','Казань',[],async()=>Response.json({choices:[{finish_reason:'stop',message:{content}}]})));
  await assert.rejects(generatePlan(config,'тест','Казань',[],async()=>Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(valid)}}]})));
  await assert.rejects(generatePlan({},'тест','Казань',[]));
  console.log('PASS: schema, truncation, missing key, HTTP failures, safe errors.');
}
