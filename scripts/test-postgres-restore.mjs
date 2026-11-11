import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Pool,types} from 'pg';
import {postgresSettings} from './postgres-migrate.mjs';
types.setTypeParser(20,Number);
const settings=postgresSettings(),url=new URL(settings.DATABASE_URL),password=parseEnv(readFileSync('.env.postgres-admin','utf8')).PG_ADMIN_PASSWORD;
const admin=new Pool({host:'127.0.0.1',port:5433,user:'naydi_admin',password,database:'postgres',max:1});
const name='restore_test_'+randomBytes(8).toString('hex');
const backups=resolve('artifacts/postgres/backups');
const latest=readdirSync(backups).filter(f=>{try{return !!readFileSync(join(backups,f,'report.json'));}catch{return false;}}).sort().at(-1);
if(!latest)throw Error('Create a backup first');
await admin.query('CREATE DATABASE '+name+' OWNER naydigo');
const drive=JSON.parse(readFileSync('.sites-runtime/postgres/drive.json','utf8')).drive;
let restored,source;
try{
 const result=spawnSync(join(drive+'/','pgsql/bin/pg_restore.exe'),['--no-owner','--no-acl','--exit-on-error','--host',url.hostname,'--port',url.port,'--username',decodeURIComponent(url.username),'--dbname',name,join(backups,latest,'naydigo.dump')],{encoding:'utf8',windowsHide:true,env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)}});
 if(result.status!==0)throw Error('Restore failed: '+result.stderr);
 const copy=new URL(url);copy.pathname='/'+name;restored=new Pool({connectionString:copy.toString(),max:1});source=new Pool({connectionString:url.toString(),max:1});
 const hash=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex'),verified=[];
 for(const table of ['shops','products','uploads','buyer_accounts','buyer_identities','buyer_sessions','onboarding']){
  const sql='SELECT * FROM '+table+' ORDER BY rowid';assert.equal(hash((await restored.query(sql)).rows),hash((await source.query(sql)).rows));verified.push(table);
 }
 writeFileSync('artifacts/postgres/restore-report.json',JSON.stringify({nativePostgres:true,realRestore:true,backup:latest,verifiedTables:verified,allHashesMatch:true},null,2));
 console.log('PASS native pg_dump/pg_restore: protected record hashes match; temporary database removed');
}finally{
 if(source)await source.end();if(restored)await restored.end();
 await admin.query('DROP DATABASE '+name+' WITH (FORCE)');await admin.end();
}
