import {Pool} from 'pg';
import {postgresSettings} from './postgres-migrate.mjs';
const {DATABASE_URL}=postgresSettings();if(!DATABASE_URL)throw Error('DATABASE_URL required: PostgreSQL only');
const pool=new Pool({connectionString:DATABASE_URL,max:1});
try{const result=await pool.query("SELECT current_database() AS database,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS synchronous_commit,(SELECT COUNT(*)::int FROM shops) AS shops,(SELECT COUNT(*)::int FROM products) AS products");console.log(JSON.stringify({engine:'PostgreSQL',...result.rows[0]},null,2));}finally{await pool.end();}
