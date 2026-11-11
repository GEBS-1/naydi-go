import {recordUsage,currentUsage} from './search-usage';
import {env} from '@/lib/server-env';
import {db} from '@/db';
export async function recordFreeCall(provider:string,ms:number,status:string){recordUsage({provider,model:'',ms,status,costRub:0,tokens:0});await db().prepare('INSERT INTO api_calls(id,month,provider,model,reserved,actual,status,data,created_at) VALUES(?,?,?,?,0,0,?,?,?)').bind(crypto.randomUUID(),new Date().toISOString().slice(0,7),provider,'',status,JSON.stringify({ms,traceId:currentUsage()?.traceId}),Date.now()).run();}
export async function budgetState(){const month=new Date().toISOString().slice(0,7);const row=await db().prepare('SELECT committed FROM api_budget WHERE month=?').bind(month).first<{committed:number}>();return {month,committedRub:(row?.committed||0)/100,warning:0};}
export async function reserveCall(provider:string,model:string){
 const month=new Date().toISOString().slice(0,7),id=crypto.randomUUID(),cap=Number(env.API_MAX_CALL_RUB||10),reserved=Math.ceil(cap*100);
 if(!Number.isFinite(reserved)||reserved<=0||reserved>2000)throw Error('Неверная настройка бюджета запроса.');
 await db().prepare('INSERT OR IGNORE INTO api_budget(month,committed) VALUES(?,0)').bind(month).run();
 await db().batch([
  db().prepare("INSERT INTO api_calls(id,month,provider,model,reserved,actual,status,data,created_at) VALUES(?,?,?,?,?,NULL,'pending','{}',?)").bind(id,month,provider,model,reserved,Date.now()),
  db().prepare('UPDATE api_budget SET committed=committed+? WHERE month=? AND EXISTS(SELECT 1 FROM api_calls WHERE id=?)').bind(reserved,month,id)
 ]);
 return {id,month,reserved};
}
export async function finishCall(call:{id:string;month:string;reserved:number},status:string,actualRub:number|null,data:unknown){
 const actual=actualRub!==null&&Number.isFinite(actualRub)&&actualRub>=0?Math.ceil(actualRub*100):null;
 await db().batch([
 db().prepare('UPDATE api_budget SET committed=committed+? WHERE month=? AND EXISTS(SELECT 1 FROM api_calls WHERE id=? AND status=\'pending\')').bind((actual??call.reserved)-call.reserved,call.month,call.id),
 db().prepare('UPDATE api_calls SET actual=?,status=?,data=? WHERE id=? AND status=\'pending\'').bind(actual,actual===null?'unknown':status,JSON.stringify(data),call.id)
 ]);
}
