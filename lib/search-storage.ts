import {db} from '@/db';
export async function cacheRead<T>(key:string):Promise<T|null>{const r=await db().prepare('SELECT data FROM search_cache WHERE id=? AND expires_at>?').bind(key,Date.now()).first<{data:string}>();return r?JSON.parse(r.data) as T:null;}
export async function cacheWrite(key:string,data:unknown,ttl:number){await db().prepare('INSERT INTO search_cache(id,data,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').bind(key,JSON.stringify(data),Date.now()+ttl).run();}
export async function acquireProvider(name:string,lease=30000){return !!await db().prepare('INSERT INTO search_locks(id,until_ms) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET until_ms=excluded.until_ms WHERE until_ms<? RETURNING id').bind(name,Date.now()+lease,Date.now()).first();}
export async function releaseProvider(name:string,delay=3000){await db().prepare('UPDATE search_locks SET until_ms=? WHERE id=?').bind(Date.now()+delay,name).run();}
