import {readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const database=new DatabaseSync(path.join(folder,readdirSync(folder).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')));
const rows=database.prepare('SELECT id,status,reserved,actual,data,created_at FROM api_calls WHERE status IN (?,?)').all('pending','unknown');
if(process.argv.includes('--retain-old-reserve'))throw Error('Bulk reconciliation disabled. Use --retain-reserve <exact-id> --approval <record of explicit owner approval>.');
if(process.argv.includes('--retain-reserve')){
 const id=process.argv[process.argv.indexOf('--retain-reserve')+1];
 const at=process.argv.indexOf('--approval'),approval=at>=0?process.argv[at+1]:'';
 if(!approval||approval.startsWith('--')||approval.length<20)throw Error('Document explicit owner approval (at least 20 characters).');
 database.exec('BEGIN IMMEDIATE');
 try{
  const row=database.prepare('SELECT * FROM api_calls WHERE id=?').get(id);
  if(!row||row.status!=='unknown'||row.actual!==null||Date.now()-row.created_at<3600000)throw Error('Only an old, unknown, unbilled call can be conservatively closed.');
  const before=database.prepare('SELECT committed FROM api_budget WHERE month=?').get(row.month);
  if(!before||before.committed<row.reserved)throw Error('Reservation accounting mismatch; manual audit required.');
  database.prepare('UPDATE api_calls SET status=?,data=? WHERE id=? AND status=?').run('reserved-unverified',JSON.stringify({...JSON.parse(row.data),reconciliation:'Full reservation retained; actual provider charge still unknown',approval,reconciledAt:new Date().toISOString()}),id,'unknown');
  if(database.prepare('SELECT committed FROM api_budget WHERE month=?').get(row.month).committed!==before.committed)throw Error('Budget unexpectedly changed');
  database.exec('COMMIT');
 }catch(e){database.exec('ROLLBACK');throw e;}
}
console.log(JSON.stringify({unresolved:database.prepare("SELECT id,status,reserved,actual,data,created_at FROM api_calls WHERE status IN ('pending','unknown')").all(),budget:database.prepare('SELECT * FROM api_budget').all()}));database.close();
