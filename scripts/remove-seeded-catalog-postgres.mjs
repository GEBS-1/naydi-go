// Remove the five ownerless Kazan seed stores only after a verified backup.
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {Pool} from 'pg';
import {getServerEnv} from './naydi-node-env.mjs';

const backup=process.argv[2];
const storeIds=[
 '06075f6a-7429-4631-978c-2f7df8aa407c',
 '35ca00cd-91ed-4137-9044-92fe85ec66e8',
 '560cf7ba-dc6e-438d-8b35-bb018cccb505',
 'aaaad33f-b0a6-4247-bf12-1487530b98eb',
 'ec9c817d-1465-4667-a5d4-11d7889cbffd',
];
const expectedNames=['КрепёжДом','Аганим Керамика','АвтоStop','Гидрокомплект','Сантехника-Кзн'];
if(!backup||!path.resolve(backup).startsWith('/var/www/naydi-data/backups/')||!existsSync(path.join(backup,'verification.json')))throw Error('A restored and verified production backup is required');
const copies=readdirSync(backup).map(name=>path.join(backup,name)).filter(directory=>existsSync(path.join(directory,'naydigo.dump'))&&existsSync(path.join(directory,'report.json')));
if(copies.length!==1)throw Error('Expected one backup dump');
const report=JSON.parse(readFileSync(path.join(copies[0],'report.json'),'utf8'));
if(!report.databaseBytes||report.databaseBytes<1024)throw Error('Backup report is incomplete');
const pool=new Pool({connectionString:getServerEnv().DATABASE_URL,max:1});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const stores=(await client.query('SELECT id,owner,data,visibility FROM shops WHERE id=ANY($1::text[]) FOR UPDATE',[storeIds])).rows;
 if(stores.length!==5||stores.some(row=>row.owner||row.visibility!=='public'||!expectedNames.includes(JSON.parse(row.data).name)))throw Error('Seed store identity or ownership changed');
 const products=(await client.query('SELECT id,store_id FROM products WHERE store_id=ANY($1::text[]) FOR UPDATE',[storeIds])).rows;
 if(products.length!==25||storeIds.some(id=>products.filter(p=>p.store_id===id).length!==5))throw Error('Expected exactly five products per seed store');
 const productIds=products.map(p=>p.id);
 const onboarding=(await client.query('SELECT store_id,created_by FROM onboarding WHERE store_id=ANY($1::text[]) FOR UPDATE',[storeIds])).rows;
 if(onboarding.length!==5||onboarding.some(row=>row.created_by!=='local_seedy'))throw Error('Unexpected onboarding owner');
 const previews=(await client.query('SELECT store_id FROM preview_tokens WHERE store_id=ANY($1::text[]) FOR UPDATE',[storeIds])).rows;
 if(previews.length!==5)throw Error('Unexpected preview token count');
 for(const [table,column,ids] of [['claims','store_id',storeIds],['inquiries','store_id',storeIds],['owner_invites','store_id',storeIds],['favorites','product_id',productIds],['chat_threads','product_id',productIds]]){
  const count=Number((await client.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=ANY($1::text[])`,[ids])).rows[0].n);
  if(count)throw Error(`${table} contains ${count} linked records`);
 }
 const cache=await client.query('SELECT id,data FROM search_cache');
 const stale=cache.rows.filter(row=>[...storeIds,...productIds].some(id=>row.data.includes(id))).map(row=>row.id);
 if(stale.length)await client.query('DELETE FROM search_cache WHERE id=ANY($1::text[])',[stale]);
 await client.query('DELETE FROM preview_tokens WHERE store_id=ANY($1::text[])',[storeIds]);
 await client.query('DELETE FROM onboarding WHERE store_id=ANY($1::text[])',[storeIds]);
 const deletedProducts=await client.query('DELETE FROM products WHERE id=ANY($1::text[]) RETURNING id',[productIds]);
 const deletedStores=await client.query('DELETE FROM shops WHERE id=ANY($1::text[]) RETURNING id',[storeIds]);
 if(deletedProducts.rowCount!==25||deletedStores.rowCount!==5)throw Error('Unexpected deletion count');
 await client.query('COMMIT');
 const totals=(await client.query('SELECT (SELECT COUNT(*) FROM shops) AS shops,(SELECT COUNT(*) FROM products) AS products')).rows[0];
 console.log(JSON.stringify({removedStores:deletedStores.rowCount,removedProducts:deletedProducts.rowCount,invalidatedCacheEntries:stale.length,remainingStores:Number(totals.shops),remainingProducts:Number(totals.products),backup}));
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
