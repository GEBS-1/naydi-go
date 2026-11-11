import {defineConfig} from 'drizzle-kit';
import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
const settings:Record<string,string>={};
for(const file of ['.env','.env.local','.env.postgres'])if(existsSync(file))Object.assign(settings,parseEnv(readFileSync(file,'utf8')));
export default defineConfig({out:'./postgres/migrations',schema:'./db/schema.ts',dialect:'postgresql',dbCredentials:{url:process.env.DATABASE_URL||settings.DATABASE_URL||''}});
