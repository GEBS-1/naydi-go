// PostgreSQL-only runtime for local development and VPS. Never creates/seeds a DB.
import {mkdirSync,readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {Pool,types} from 'pg';
import {postgresDB} from './postgres-db.mjs';
let cached;
export function getServerEnv(){
 if(cached)return cached;
 const configured={};
 for(const file of ['.env','.env.buyer','.env.local','.env.postgres','/var/www/naydi-data/runtime.env']){
  if(existsSync(file))Object.assign(configured,parseEnv(readFileSync(file,'utf8')));
 }
 const values={...configured,...process.env};
 // Vite imports .env values into process.env. The dedicated local database profile
 // must retain its localhost callback instead of inheriting a production URL.
 if(process.env.NODE_ENV==='development'&&existsSync('.env.postgres')){const local=parseEnv(readFileSync('.env.postgres','utf8'));if(local.AUTH_BASE_URL)values.AUTH_BASE_URL=local.AUTH_BASE_URL;}
 if(!values.DATABASE_URL)throw Error('DATABASE_URL обязателен: НайдиGo использует только PostgreSQL.');
 types.setTypeParser(20,value=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Unsafe PostgreSQL bigint');return n;});
 types.setTypeParser(1700,value=>{const n=Number(value);if(!Number.isFinite(n))throw Error('Invalid PostgreSQL numeric');return n;});
 const pool=new Pool({connectionString:values.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
 pool.on('error',()=>console.error('PostgreSQL connection unavailable'));
 const bucketDir=resolve(values.NAYDI_BUCKET||'.sites-runtime/photos');mkdirSync(bucketDir,{recursive:true});
 function objectPath(key){if(!/^[a-zA-Z0-9_-]{1,160}$/.test(key))throw Error('Invalid photo key');return join(realpathSync(bucketDir),key);}
 const BUCKET={async put(key,bytes,opts){const file=objectPath(key);writeFileSync(file,Buffer.from(bytes));writeFileSync(file+'.meta',JSON.stringify(opts?.httpMetadata||{}));},async get(key){const file=objectPath(key);if(!existsSync(file))return null;return {body:readFileSync(file),httpMetadata:existsSync(file+'.meta')?JSON.parse(readFileSync(file+'.meta','utf8')):{}};}};
 cached={...values,DB:postgresDB(pool),BUCKET,AUTH_TRUSTED_PROXY:values.NODE_ENV==='development'?'1':'0'};
 return cached;
}
