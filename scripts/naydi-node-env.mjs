// VPS adapter: existing SQLite and photo directory, no seed/reset/import.
import {mkdirSync,readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {parseEnv} from 'node:util';
const settings='/var/www/naydi-data/runtime.env';
if(existsSync(settings)){const vars=parseEnv(readFileSync(settings,'utf8'));for(const [k,v] of Object.entries(vars))process.env[k]=v;}
const dbFile=process.env.NAYDI_DB||'/var/www/naydi-data/naydi.sqlite';
const bucketDir=process.env.NAYDI_BUCKET||'/var/www/naydi-data/bucket';
if(!existsSync(dbFile))throw Error('Existing NaydiGo database required; refusing to create empty database');
mkdirSync(bucketDir,{recursive:true});
// Match SQLite/D1 compatibility for existing queries containing double-quoted literals.
const sqlite=new DatabaseSync(dbFile,{enableDoubleQuotedStringLiterals:true});sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 first(column){const row=sqlite.prepare(this.sql).get(...this.args);return column?row?.[column]??null:row??null;}
 all(){return {success:true,results:sqlite.prepare(this.sql).all(...this.args)};}
 run(){const r=sqlite.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
}
const DB={prepare:sql=>new Statement(sql),batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
function objectPath(key){if(!/^[a-zA-Z0-9_-]{1,160}$/.test(key))throw Error('Invalid photo key');return join(realpathSync(bucketDir),key);}
const BUCKET={async put(key,bytes,opts){const file=objectPath(key);writeFileSync(file,Buffer.from(bytes));writeFileSync(file+'.meta',JSON.stringify(opts?.httpMetadata||{}));},async get(key){const file=objectPath(key);if(!existsSync(file))return null;return {body:readFileSync(file),httpMetadata:existsSync(file+'.meta')?JSON.parse(readFileSync(file+'.meta','utf8')):{}};}};
const names=['ADMIN_BUYER_ID','YANDEX_CLIENT_ID','YANDEX_CLIENT_SECRET','YANDEX_AUTH_ENABLED','BUYER_AUTH_ENABLED','BUYER_QUOTA_ENABLED','AUTH_BASE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_BOT_USERNAME','TELEGRAM_WEBHOOK_SECRET','OWNER_TELEGRAM_CHAT_ID','MAX_BOT_TOKEN','MAX_BOT_URL','MAX_WEBHOOK_SECRET','OWNER_MAX_USER_ID','MAX_AUTH_ENABLED','MAX_API_BASE_URL','YOOKASSA_ENABLED','YOOKASSA_SHOP_ID','YOOKASSA_SECRET_KEY','YOOKASSA_TEST_MODE','ADMIN_EMAIL','AUTH_ACCESS_ISSUER','AUTH_ACCESS_AUD','ROUTERAI_API_KEY','ROUTERAI_MODEL','ROUTERAI_WEB_MODEL','ROUTERAI_WEB_MODE','API_MONTHLY_LIMIT_RUB','API_MAX_CALL_RUB','API_UNCERTAIN_LIMIT_RUB','OVERPASS_URL','PHOTON_URL','VALHALLA_URL'];
globalThis.__naydiEnv={DB,BUCKET,...Object.fromEntries(names.map(k=>[k,process.env[k]||undefined])),AUTH_TRUSTED_PROXY:'0'};
registerHooks({load(url,context,next){if(url==='cloudflare:workers')return {format:'module',source:'export const env=globalThis.__naydiEnv;',shortCircuit:true};return next(url,context);}});
