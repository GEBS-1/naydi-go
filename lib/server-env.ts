// Server-only Node runtime. No D1/SQLite fallback.
import {getServerEnv} from '../scripts/naydi-node-env.mjs';
import type {Database,PhotoStore} from '@/db/types';
type RuntimeEnv=Omit<Cloudflare.Env,'DB'|'BUCKET'>&{DB?:Database;BUCKET?:PhotoStore};
export const env=new Proxy({} as RuntimeEnv,{
 get(_target,key){return getServerEnv()[key as string];},
});
