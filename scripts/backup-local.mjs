import {DatabaseSync} from 'node:sqlite';
import {readdirSync,mkdirSync,copyFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
const manifest=[];
function copyStorage(source,target){
 mkdirSync(target,{recursive:true});
 for(const entry of readdirSync(source,{withFileTypes:true})){
  const from=path.join(source,entry.name),to=path.join(target,entry.name);
  if(entry.isSymbolicLink())throw Error('Backup refuses symbolic links: '+entry.name);
  if(entry.isDirectory()){copyStorage(from,to);continue;}
  if(/\.sqlite-(?:wal|shm)$/.test(entry.name))continue; // Included in SQLite's consistent snapshot.
  if(entry.name.endsWith('.sqlite')){
   const src=new DatabaseSync(from,{readOnly:true});
   try{src.exec(`VACUUM INTO '${to.replaceAll("'","''")}'`);}finally{src.close();}
   const check=new DatabaseSync(to,{readOnly:true});
   try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('R2 metadata integrity failed');}finally{check.close();}
  }else{
   copyFileSync(from,to);
   if(!readFileSync(from).equals(readFileSync(to)))throw Error('Blob copy mismatch');
  }
  const bytes=readFileSync(to);manifest.push({path:path.relative(destination,to),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
}
// Run without concurrent uploads/deletes. Each SQLite snapshot includes committed WAL data.
if(existsSync('.wrangler/state/v3/r2'))copyStorage(path.resolve('.wrangler/state/v3/r2'),path.join(destination,'r2'));
writeFileSync(path.join(destination,'manifest.json'),JSON.stringify({at:new Date().toISOString(),files:manifest,scope:'Local D1/R2 only; not a production backup'},null,2));
console.log('D1 snapshot verified; local R2 snapshots and blob hashes verified. Keep backup private.');
