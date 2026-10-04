import {readFileSync,readdirSync,copyFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
const root=path.resolve('artifacts'),name=process.argv[2];if(!/^backup-[\dTZ-]+$/.test(name||''))throw Error('Pass an exact local backup directory name');
const backup=path.join(root,name),target=path.join(root,'restore-check-'+Date.now());mkdirSync(target);
const manifest=JSON.parse(readFileSync(path.join(backup,'manifest.json'),'utf8'));
for(const item of [{path:'catalog.sqlite'},...manifest.files]){
 const source=path.resolve(backup,item.path),dest=path.resolve(target,item.path);
 if(!source.startsWith(backup+path.sep)||!dest.startsWith(target+path.sep))throw Error('Unsafe manifest path');
 const bytes=readFileSync(source);if(item.sha256&&createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Backup hash mismatch');
 mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(source,dest);
 if(!readFileSync(dest).equals(bytes))throw Error('Restore byte mismatch');
 if(dest.endsWith('.sqlite')){const db=new DatabaseSync(dest,{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Restored SQLite corrupt');}finally{db.close();}}
}
const db=new DatabaseSync(path.join(target,'catalog.sqlite'),{readOnly:true});const summary={target,shops:db.prepare('SELECT count(*) n FROM shops').get().n,products:db.prepare('SELECT count(*) n FROM products').get().n,r2Files:manifest.files.length,passed:true,scope:'Isolated local restore; active state untouched. Not a production restore or live R2 read test.'};db.close();writeFileSync(path.join(target,'restore-result.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
