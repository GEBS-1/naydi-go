// Explicit copy into an EMPTY database. Source SQLite is always read-only.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {Pool,types} from 'pg';
import {postgresSchema} from './postgres-schema.mjs';
import {postgresMigrate} from './postgres-migrate.mjs';
types.setTypeParser(20,value=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Unsafe bigint');return n;});
export async function copyToPostgres(sqlite,client){
 const schema=postgresSchema(sqlite),report={tables:{}};
 const present=await client.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema()");
 if(present.rows.length)throw Error('Target database is not empty; refusing to overwrite');
 if(!schema.tables.includes('buyer_identities'))throw Error('Apply all local SQLite migrations first');
 const q=name=>'"'+name.replaceAll('"','""')+'"';
 const digest=rows=>createHash('sha256').update(JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))))).digest('hex');
 await client.query('BEGIN');
 try{
  for(const sql of schema.create)await client.query(sql);
  for(const table of schema.tables){
   const rows=sqlite.prepare(`SELECT rowid AS rowid,* FROM ${q(table)} ORDER BY rowid`).all();
   for(const row of rows){const fields=Object.keys(row);await client.query(`INSERT INTO ${q(table)} (${fields.map(q).join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));}
   const copied=(await client.query(`SELECT * FROM ${q(table)} ORDER BY rowid`)).rows;
   if(digest(rows)!==digest(copied))throw Error('Data verification failed for '+table);
   await client.query(`SELECT setval(pg_get_serial_sequence('${table}','rowid'),COALESCE((SELECT MAX(rowid) FROM ${q(table)}),0)+1,false)`);
   report.tables[table]={count:rows.length,verified:true};
  }
  for(const sql of [...schema.indexes,...schema.constraints])await client.query(sql);
  await client.query('COMMIT');return report;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
if(process.argv[1]?.endsWith('migrate-postgres.mjs')){
 const source=process.env.NAYDI_SQLITE_SOURCE,url=process.env.DATABASE_URL;
 if(!source||!url)throw Error('Set NAYDI_SQLITE_SOURCE and DATABASE_URL; destination must be empty');
 const sqlite=new DatabaseSync(source,{readOnly:true}),pool=new Pool({connectionString:url,max:1}),client=await pool.connect();
 try{const report=await copyToPostgres(sqlite,client);await postgresMigrate(client,{baselineOnly:true});await postgresMigrate(client);console.log(JSON.stringify(report,null,2));}
 finally{client.release();await pool.end();sqlite.close();}
}
