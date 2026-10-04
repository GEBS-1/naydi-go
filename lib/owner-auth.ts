import {db} from '@/db';
export const sessionName='ng_owner';
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
export function cookieToken(cookie:string|null){return cookie?.match(/(?:^|;\s*)ng_owner=([a-f0-9]{64})(?:;|$)/)?.[1];}
export async function ownerIdentity(cookie:string|null){const raw=cookieToken(cookie);if(!raw)return null;const user=await db().prepare('SELECT a.id,a.email FROM owner_sessions s JOIN owner_accounts a ON a.id=s.user_id WHERE s.hash=? AND s.expires_at>?').bind(await digest(raw),Date.now()).first<{id:string;email:string}>();return user?{userId:user.id,email:user.email,displayName:user.email,fullName:null}:null;}
export function ownerCookie(raw:string,req:Request,maxAge=7*86400){const local=['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname);return `${sessionName}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${local?'':'; Secure'}`;}
export function requireBrowserOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')throw Error('Недопустимый источник запроса');}
export async function revokeSession(cookie:string|null){const raw=cookieToken(cookie);if(raw)await db().prepare('DELETE FROM owner_sessions WHERE hash=?').bind(await digest(raw)).run();}
