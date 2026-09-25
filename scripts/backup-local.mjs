import {DatabaseSync} from 'node:sqlite';
import {readdirSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import path from 'node:path';
const folder=path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const destination=path.resolve('artifacts','backup-'+new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(destination,{recursive:true});
let found=false;
for(const file of readdirSync(folder).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')){
 const database=new DatabaseSync(path.join(folder,file));
 if(database.prepare("SELECT name FROM sqlite_master WHERE name='shops'").get()){
  database.exec(`VACUUM INTO '${path.join(destination,'catalog.sqlite').replaceAll("'","''")}'`);
  const copy=new DatabaseSync(path.join(destination,'catalog.sqlite'),{readOnly:true});
  console.log(JSON.stringify({backup:destination,integrity:copy.prepare('PRAGMA integrity_check').get(),shops:copy.prepare('SELECT COUNT(*) AS count FROM shops').get(),products:copy.prepare('SELECT COUNT(*) AS count FROM products').get()}));
  copy.close();found=true;
 }
 database.close();
}
if(!found)throw new Error('Каталог не найден — миграции не выполнять');
if(existsSync('.wrangler/state/v3/r2'))cpSync('.wrangler/state/v3/r2',path.join(destination,'r2'),{recursive:true});
console.log('D1 snapshot verified; local R2 copied. Keep backup private.');
