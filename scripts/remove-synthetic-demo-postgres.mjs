import {existsSync} from 'node:fs';
import path from 'node:path';
import {Pool} from 'pg';
import {getServerEnv} from './naydi-node-env.mjs';

const backup=process.argv[2];
if(!backup||!existsSync(path.join(backup,'naydigo.dump'))||!existsSync(path.join(backup,'report.json')))throw Error('Verified PostgreSQL backup required');
const targetStores=['demo-s0','demo-s1','demo-s2'];
const targetProducts=Array.from({length:30},(_,i)=>`demo-p${i}`);
const pool=new Pool({connectionString:getServerEnv().DATABASE_URL,max:1});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const stores=(await client.query('SELECT id,owner,data FROM shops WHERE id=ANY($1::text[]) FOR UPDATE',[targetStores])).rows;
 const products=(await client.query('SELECT id,store_id,data FROM products WHERE id=ANY($1::text[]) FOR UPDATE',[targetProducts])).rows;
 if(stores.length!==3||stores.some(row=>row.owner||JSON.parse(row.data).demo!==true))throw Error('Store identity/ownership check failed');
 if(products.length!==30||products.some(row=>!targetStores.includes(row.store_id)||JSON.parse(row.data).demo!==true))throw Error('Product identity check failed');
 const all=(await client.query('SELECT id FROM products WHERE store_id=ANY($1::text[])',[targetStores])).rows;
 if(all.length!==30||all.some(row=>!targetProducts.includes(row.id)))throw Error('Unexpected products linked to demo stores');
 for(const [table,column,ids] of [['claims','store_id',targetStores],['inquiries','store_id',targetStores],['onboarding','store_id',targetStores],['owner_invites','store_id',targetStores],['preview_tokens','store_id',targetStores],['favorites','product_id',targetProducts]]){
  const count=Number((await client.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=ANY($1::text[])`,[ids])).rows[0].n);
  if(count)throw Error(`${table} has ${count} linked records`);
 }
 const deletedProducts=await client.query('DELETE FROM products WHERE id=ANY($1::text[]) RETURNING id',[targetProducts]);
 const deletedStores=await client.query('DELETE FROM shops WHERE id=ANY($1::text[]) RETURNING id',[targetStores]);
 if(deletedProducts.rowCount!==30||deletedStores.rowCount!==3)throw Error('Unexpected deletion count');
 await client.query('COMMIT');
 const totals=(await client.query('SELECT (SELECT COUNT(*) FROM shops) AS shops,(SELECT COUNT(*) FROM products) AS products')).rows[0];
 console.log(JSON.stringify({scope:'configured PostgreSQL',removedStores:deletedStores.rowCount,removedProducts:deletedProducts.rowCount,remainingStores:Number(totals.shops),remainingProducts:Number(totals.products),backup}));
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
