if(process.platform==='win32'){const {localPostgres}=await import('./local-postgres.mjs');await localPostgres();}
const {getServerEnv}=await import('./naydi-node-env.mjs');
await getServerEnv().DB.prepare('SELECT 1 FROM buyer_identities LIMIT 1').first();
process.argv=[process.execPath,new URL('../node_modules/vinext/dist/cli.js',import.meta.url).pathname,'start',...process.argv.slice(2)];
await import('../node_modules/vinext/dist/cli.js');
