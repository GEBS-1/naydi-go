import {mkdirSync,readFileSync,statSync,copyFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {postgresSettings} from './postgres-migrate.mjs';
const settings=postgresSettings();if(!settings.DATABASE_URL)throw Error('DATABASE_URL required');
const url=new URL(settings.DATABASE_URL),stamp=new Date().toISOString().replaceAll(/[:.]/g,'-');
const directory=resolve(settings.NAYDI_BACKUP_DIR||'artifacts/postgres/backups',stamp);mkdirSync(directory,{recursive:true});
const executable=process.platform==='win32'?join(JSON.parse(readFileSync('.sites-runtime/postgres/drive.json','utf8')).drive+'/','pgsql/bin/pg_dump.exe'):'pg_dump';
const file=join(directory,'naydigo.dump');
console.log('Creating PostgreSQL dump...');
const result=spawnSync(executable,['--format=custom','--no-owner','--no-acl','--host',url.hostname,'--port',url.port||'5432','--username',decodeURIComponent(url.username),'--dbname',url.pathname.slice(1),'--file',file],{encoding:'utf8',windowsHide:true,env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)}});
console.log('Dump process finished:',result.status);
if(result.status!==0)throw Error('pg_dump failed: '+result.stderr);
const photos=resolve(settings.NAYDI_BUCKET||'.sites-runtime/photos');if(existsSync(photos)){const target=join(directory,'photos');mkdirSync(target);for(const name of readdirSync(photos)){if(!statSync(join(photos,name)).isFile())throw Error('Unexpected photo directory entry');copyFileSync(join(photos,name),join(target,name));}}
writeFileSync(join(directory,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),format:'PostgreSQL custom dump',databaseBytes:statSync(file).size,photosIncluded:existsSync(photos)},null,2));
console.log('PostgreSQL + photos backup:',directory);
