import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
export function postgresSettings(){
 const files={};for(const file of ['.env','.env.local','.env.postgres','/var/www/naydi-data/runtime.env'])if(existsSync(file))Object.assign(files,parseEnv(readFileSync(file,'utf8')));
 return {...files,...process.env};
}
export async function postgresMigrate(client,{baselineOnly=false}={}){
 await client.query('BEGIN');
 try{
  await client.query("SELECT pg_advisory_xact_lock(718204501)");
  await client.query('CREATE TABLE IF NOT EXISTS naydi_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at BIGINT NOT NULL)');
  for(const name of readdirSync('postgres/migrations').filter(f=>f.endsWith('.sql')).sort()){
   const sql=readFileSync('postgres/migrations/'+name,'utf8'),sha=createHash('sha256').update(sql).digest('hex');
   const old=(await client.query('SELECT sha256 FROM naydi_migrations WHERE name=$1',[name])).rows[0];
   if(old){if(old.sha256!==sha)throw Error('Applied PostgreSQL migration changed: '+name);continue;}
   if(!baselineOnly)await client.query(sql);
   else if(name!=='0001_initial.sql')continue;
   await client.query('INSERT INTO naydi_migrations VALUES($1,$2,$3)',[name,sha,Date.now()]);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
}
if(process.argv[1]?.endsWith('postgres-migrate.mjs')){
 const settings=postgresSettings();if(!settings.DATABASE_URL)throw Error('DATABASE_URL required');
 const pool=new Pool({connectionString:settings.DATABASE_URL,max:1}),client=await pool.connect();
 try{await postgresMigrate(client);console.log('PostgreSQL migrations applied; existing data preserved.');}finally{client.release();await pool.end();}
}
