import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
const physical=resolve('.sites-runtime/postgres');
// PostgreSQL's Windows bootstrap cannot encode a Cyrillic installation path in C locale.
// A drive alias points to the SAME project folder; no database files are moved.
let root=physical;
if(process.platform==='win32'){
 const config=join(physical,'drive.json');
 const drive=existsSync(config)?JSON.parse(readFileSync(config,'utf8')).drive:['N:','P:','Q:','R:','S:','T:','U:','V:','W:','X:','Y:','Z:'].find(d=>!existsSync(d+'/'));
 if(!/^[N-Z]:$/.test(drive||''))throw Error('No free PostgreSQL drive alias');
 const marker=join(physical,'drive-marker');if(!existsSync(marker))writeFileSync(marker,randomBytes(32).toString('hex'));
 if(!existsSync(drive+'/')){const mapped=spawnSync('subst',[drive,physical],{windowsHide:true,encoding:'utf8'});if(mapped.status!==0)throw Error('Could not map PostgreSQL path');}
 if(!existsSync(drive+'/drive-marker')||readFileSync(drive+'/drive-marker','utf8')!==readFileSync(marker,'utf8'))throw Error('PostgreSQL drive letter belongs to another directory');
 writeFileSync(config,JSON.stringify({drive}));root=drive+'/';
}
const bin=join(root,'pgsql/bin'),data=join(root,'data');
const suffix=process.platform==='win32'?'.exe':'';
function run(name,args,ok=[0]){const r=spawnSync(join(bin,name+suffix),args,{encoding:'utf8',windowsHide:true,timeout:60000,stdio:name==='pg_ctl'&&args.includes('start')?'ignore':['ignore','pipe','pipe']});if(r.error)throw r.error;if(!ok.includes(r.status))throw Error(name+' failed: '+r.stderr+' '+r.stdout);return r;}
export async function localPostgres(action='start'){
 if(!existsSync(join(bin,'pg_ctl'+suffix)))throw Error('Install the official PostgreSQL binaries in .sites-runtime/postgres/pgsql first');
 mkdirSync(root,{recursive:true});
 if(!existsSync('.env.postgres-admin')){
  if(existsSync(join(data,'PG_VERSION')))throw Error('Existing cluster without credentials; refusing to reinitialize');
  writeFileSync('.env.postgres-admin','PG_ADMIN_PASSWORD='+randomBytes(32).toString('hex')+'\n',{mode:0o600});
 }
 const admin=parseEnv(readFileSync('.env.postgres-admin','utf8'));
 if(!existsSync(join(data,'PG_VERSION'))){
  const pw=join(root,'init-password');writeFileSync(pw,admin.PG_ADMIN_PASSWORD,{mode:0o600});
  try{run('initdb',['-D',data,'-U','naydi_admin','-E','UTF8','--locale=C','--auth=scram-sha-256','--pwfile='+pw]);}finally{unlinkSync(pw);}
  writeFileSync(join(data,'postgresql.auto.conf'),"listen_addresses = '127.0.0.1'\nport = 5433\npassword_encryption = 'scram-sha-256'\nfsync = on\nsynchronous_commit = on\nfull_page_writes = on\n");
 }
 const status=run('pg_ctl',['-D',data,'status'],[0,3]);
 if(action==='stop'){if(status.status===0)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);return;}
 if(status.status!==0)run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-w','start']);
 const pool=new Pool({host:'127.0.0.1',port:5433,user:'naydi_admin',password:admin.PG_ADMIN_PASSWORD,database:'postgres',connectionTimeoutMillis:5000});
 try{
  if(!existsSync('.env.postgres')){
   const password=randomBytes(32).toString('hex');
   if((await pool.query("SELECT 1 FROM pg_roles WHERE rolname='naydigo'")).rowCount)throw Error('Existing application role; refusing to replace its password');
   // Password is random hex and never printed or put on a command line.
   await pool.query("CREATE ROLE naydigo LOGIN PASSWORD '"+password+"' NOSUPERUSER NOCREATEDB NOCREATEROLE");
   await pool.query('CREATE DATABASE naydigo OWNER naydigo');
   writeFileSync('.env.postgres',`DATABASE_URL=postgresql://naydigo:${password}@127.0.0.1:5433/naydigo\nNAYDI_BUCKET=${resolve('.sites-runtime/photos').replaceAll('\\','/')}\nAUTH_BASE_URL=http://localhost:3001\n`,{mode:0o600});
  }
 }finally{await pool.end();}
 console.log('PostgreSQL ready: 127.0.0.1:5433, persistent cluster (credentials hidden).');
}
if(process.argv[1]?.endsWith('local-postgres.mjs'))await localPostgres(process.argv[2]||'start');
