import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const database=new DatabaseSync(':memory:');database.exec(await readFile('drizzle/0004_acoustic_stepford_cuckoos.sql','utf8'));
const wrap=(sql,args=[])=>({bind:(...values)=>wrap(sql,values),first:async()=>database.prepare(sql).get(...args)||null,run:async()=>({meta:{changes:database.prepare(sql).run(...args).changes}})});
globalThis.budgetTestDB={prepare:sql=>wrap(sql),batch:async statements=>{database.exec('BEGIN');try{const rows=[];for(const s of statements)rows.push(await s.run());database.exec('COMMIT');return rows;}catch(e){database.exec('ROLLBACK');throw e;}}};
let source=await readFile('lib/api-budget.ts','utf8');source=source.replace("import {env} from 'cloudflare:workers';","const env={API_MONTHLY_LIMIT_RUB:'3000',API_MAX_CALL_RUB:'20'};").replace("import {db} from '@/db';","const db=()=>globalThis.budgetTestDB;");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {reserveCall,finishCall,budgetState}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const c=await reserveCall('test','model');assert.equal((await budgetState()).committedRub,20);await assert.rejects(reserveCall('test','model'));
await finishCall(c,'complete',.123,{tokens:10});assert.equal((await budgetState()).committedRub,.13);
await finishCall(c,'complete',.123,{});assert.equal((await budgetState()).committedRub,.13,'idempotent settlement');
for(const [sum,threshold] of [[150000,50],[240000,80],[300000,100]]){database.prepare('UPDATE api_budget SET committed=?').run(sum);assert.equal((await budgetState()).warning,threshold);}
await assert.rejects(reserveCall('test','model'),'monthly stop');database.prepare('UPDATE api_budget SET committed=299000').run();await assert.rejects(reserveCall('test','model'),'reservation cannot cross limit');
database.prepare('UPDATE api_budget SET committed=0').run();const unknown=await reserveCall('test','model');await finishCall(unknown,'unknown',null,{});assert.equal((await budgetState()).committedRub,20);await assert.rejects(reserveCall('test','model'),'unknown billing blocks further paid calls');
console.log('PASS: durable reservation, single in-flight call, idempotent settlement, 50/80/100 warnings, monthly stop, unknown cost fail-closed. In-memory test only.');database.close();
