import {readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const folder='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const file=readdirSync(folder).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite');
const database=new DatabaseSync(folder+file,{readOnly:!process.argv.includes('--delete-expired')});
const rows=database.prepare("SELECT id,expires_at FROM search_cache WHERE id LIKE 'seller-catalog:%' ORDER BY id").all();
if(process.argv.includes('--delete-expired'))database.prepare("DELETE FROM search_cache WHERE id LIKE 'seller-catalog:%' AND expires_at<=?").run(Date.now());
console.log(JSON.stringify({rows,deletedExpiredOnly:process.argv.includes('--delete-expired')},null,2));database.close();
