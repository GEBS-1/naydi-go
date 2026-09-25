import {env} from 'cloudflare:workers';
import {db} from '@/db';
export const MONTH_LIMIT=300000; // integer kopecks; environment may only lower the user's limit
export async function recordFreeCall(provider:string,ms:number,status:string){await db().prepare('INSERT INTO api_calls(id,month,provider,model,reserved,actual,status,data,created_at) VALUES(?,?,?,?,0,0,?,?,?)').bind(crypto.randomUUID(),new Date().toISOString().slice(0,7),provider,'',status,JSON.stringify({ms}),Date.now()).run();}
export function limitKopecks(){const n=Number(env.API_MONTHLY_LIMIT_RUB||3000);return Number.isFinite(n)?Math.max(0,Math.min(MONTH_LIMIT,Math.floor(n*100))):0;}
export async function budgetState(){const month=new Date().toISOString().slice(0,7);const row=await db().prepare('SELECT committed FROM api_budget WHERE month=?').bind(month).first<{committed:number}>();const used=row?.committed||0,limit=limitKopecks();return {month,committedRub:used/100,limitRub:limit/100,warning:used>=limit?100:used>=limit*.8?80:used>=limit*.5?50:0};}
export async function reserveCall(provider:string,model:string){
 const month=new Date().toISOString().slice(0,7),id=crypto.randomUUID(),cap=Number(env.API_MAX_CALL_RUB||20),reserved=Math.ceil(cap*100);
 if(!Number.isFinite(reserved)||reserved<=0||reserved>2000)throw Error('Неверная настройка бюджета запроса.');
 // Unknown billing is fail-closed. A timed-out/crashed call must be reconciled, never retried for free.
 const unknown=await db().prepare("SELECT id FROM api_calls WHERE month=? AND status IN ('pending','unknown') LIMIT 1").bind(month).first();if(unknown)throw Error('Платный поиск приостановлен: ожидается сверка стоимости предыдущего вызова.');
 await db().prepare('INSERT OR IGNORE INTO api_budget(month,committed) VALUES(?,0)').bind(month).run();
 const results=await db().batch([
  db().prepare("INSERT INTO api_calls(id,month,provider,model,reserved,actual,status,data,created_at) SELECT ?,?,?,?,?,NULL,'pending','{}',? WHERE (SELECT committed FROM api_budget WHERE month=?)+?<=? AND NOT EXISTS(SELECT 1 FROM api_calls WHERE month=? AND status IN ('pending','unknown'))").bind(id,month,provider,model,reserved,Date.now(),month,reserved,limitKopecks(),month),
  db().prepare('UPDATE api_budget SET committed=committed+? WHERE month=? AND EXISTS(SELECT 1 FROM api_calls WHERE id=?)').bind(reserved,month,id)
 ]);
 if(!results[0].meta.changes)throw Error('Лимит платного поиска достигнут или другой запрос ещё выполняется. Поиск по индексу доступен.');
 return {id,month,reserved};
}
export async function finishCall(call:{id:string;month:string;reserved:number},status:string,actualRub:number|null,data:unknown){
 const actual=actualRub!==null&&Number.isFinite(actualRub)&&actualRub>=0?Math.ceil(actualRub*100):null;
 await db().batch([
 db().prepare('UPDATE api_budget SET committed=committed+? WHERE month=? AND EXISTS(SELECT 1 FROM api_calls WHERE id=? AND status=\'pending\')').bind((actual??call.reserved)-call.reserved,call.month,call.id),
 db().prepare('UPDATE api_calls SET actual=?,status=?,data=? WHERE id=? AND status=\'pending\'').bind(actual,actual===null?'unknown':status,JSON.stringify(data),call.id)
 ]);
}
