import {readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const database=new DatabaseSync(folder+readdirSync(folder).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'),{readOnly:true});
console.log(JSON.stringify({at:new Date().toISOString(),budget:database.prepare('SELECT * FROM api_budget').all(),unresolved:database.prepare('SELECT status,COUNT(*) calls,SUM(reserved)/100.0 reservedRub FROM api_calls WHERE actual IS NULL GROUP BY status').all()},null,2));
database.close();
