// One-time legacy import, then PostgreSQL migrations only. No seed/reset.
import {existsSync,readdirSync,mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {Pool,types} from 'pg';
import {localPostgres} from './local-postgres.mjs';
import {postgresSettings,postgresMigrate} from './postgres-migrate.mjs';
import {copyToPostgres} from './migrate-postgres.mjs';
await localPostgres();
const settings=postgresSettings(),pool=new Pool({connectionString:settings.DATABASE_URL,max:1}),client=await pool.connect();
types.setTypeParser(20,Number);
const output=resolve('artifacts/postgres');mkdirSync(output,{recursive:true});
try{
 const existing=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
 if(!existing.length){
  const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
  const sources=existsSync(folder)?readdirSync(folder).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite'):[];
  if(sources.length>1)throw Error('Multiple legacy DB files: select the correct snapshot explicitly');
  if(sources.length){
   const legacy=new DatabaseSync(join(folder,sources[0]),{readOnly:true});
   const snapshot=join(output,'legacy-before-postgres-'+Date.now()+'.sqlite');
   try{await backup(legacy,snapshot);}finally{legacy.close();}
   const source=new DatabaseSync(snapshot,{readOnly:true});
   try{const report=await copyToPostgres(source,client);await postgresMigrate(client,{baselineOnly:true});await postgresMigrate(client);writeFileSync(join(output,'migration-live-report.json'),JSON.stringify({sourceSnapshot:snapshot,destination:'PostgreSQL 127.0.0.1:5433/naydigo',...report},null,2));}
   finally{source.close();}
  }else await postgresMigrate(client);
 }else await postgresMigrate(client);
 const r2='.wrangler/state/v3/r2/miniflare-R2BucketObject',photos=resolve(settings.NAYDI_BUCKET||'.sites-runtime/photos');mkdirSync(photos,{recursive:true});let count=0;
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const photoMarker=resolve('.sites-runtime/postgres/legacy-photos-imported.json');
 if(!existsSync(photoMarker)&&existsSync(r2))for(const file of readdirSync(r2).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')){
  const metadata=new DatabaseSync(join(r2,file),{readOnly:true});
  try{for(const item of metadata.prepare('SELECT key,blob_id,size,http_metadata FROM _mf_objects').all()){
   if(!/^[a-zA-Z0-9_-]{1,160}$/.test(item.key)||!item.blob_id||!/^[a-zA-Z0-9]+$/.test(item.blob_id))throw Error('Unsupported legacy photo');
   const src=join('.wrangler/state/v3/r2/site-creator-r2/blobs',item.blob_id),target=join(photos,item.key),bytes=readFileSync(src);
   if(bytes.length!==item.size)throw Error('Photo size mismatch');
   if(existsSync(target)&&hash(readFileSync(target))!==hash(bytes))throw Error('Refusing to replace changed photo');
   if(!existsSync(target))copyFileSync(src,target);
   if(!existsSync(target+'.meta'))writeFileSync(target+'.meta',item.http_metadata);
   if(hash(readFileSync(target))!==hash(bytes))throw Error('Photo verification failed');count++;
  }}finally{metadata.close();}
 }
 if(!existsSync(photoMarker))writeFileSync(photoMarker,JSON.stringify({verifiedPhotos:count,at:new Date().toISOString()}));
 console.log('PostgreSQL ready. Original SQLite retained as a migration backup. Verified photos:',count);
}finally{client.release();await pool.end();}
