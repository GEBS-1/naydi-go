import assert from 'node:assert/strict';
import {Pool,types} from 'pg';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {postgresSettings} from './postgres-migrate.mjs';
import {localPostgres} from './local-postgres.mjs';
types.setTypeParser(20,Number);
const url=postgresSettings().DATABASE_URL,id='persistence-test:'+randomUUID(),value=JSON.stringify({probe:randomUUID()});
let pool=new Pool({connectionString:url,max:1});
const before=(await pool.query('SELECT (SELECT COUNT(*) FROM shops) AS shops,(SELECT COUNT(*) FROM products) AS products')).rows[0];
await pool.query('INSERT INTO search_cache(id,data,expires_at) VALUES($1,$2,$3)',[id,value,Date.now()+600000]);
const oldPid=(await pool.query('SELECT pg_postmaster_start_time() AS started')).rows[0].started;
await pool.end();await localPostgres('stop');await localPostgres('start');
pool=new Pool({connectionString:url,max:1});
try{
 assert.equal((await pool.query('SELECT data FROM search_cache WHERE id=$1',[id])).rows[0].data,value);
 const after=(await pool.query('SELECT (SELECT COUNT(*) FROM shops) AS shops,(SELECT COUNT(*) FROM products) AS products')).rows[0];assert.deepEqual(after,before);
 assert.notEqual(String((await pool.query('SELECT pg_postmaster_start_time() AS started')).rows[0].started),String(oldPid));
 const response=await fetch('http://localhost:3001/api/catalog');assert.equal(response.status,200);
 await pool.query('DELETE FROM search_cache WHERE id=$1',[id]);
 writeFileSync('artifacts/postgres/persistence-report.json',JSON.stringify({nativePostgres:true,realRestart:true,dataSurvived:true,counts:after,applicationReconnected:true},null,2));
 console.log('PASS real PostgreSQL restart: persisted write, shops/products intact, application reconnected');
}finally{await pool.end();}
