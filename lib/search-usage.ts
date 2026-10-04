import {AsyncLocalStorage} from 'node:async_hooks';
export type Usage={traceId:string;calls:{provider:string;model:string;ms:number;costRub:number|null;tokens:number|null;status:string}[];cacheHits:number};
const scope=new AsyncLocalStorage<Usage>();
export function withUsage<T>(fn:()=>Promise<T>){return scope.getStore()?fn():scope.run({traceId:crypto.randomUUID(),calls:[],cacheHits:0},fn);}
export function recordUsage(call:Usage['calls'][number]){scope.getStore()?.calls.push(call);}
export function cacheHit(){const s=scope.getStore();if(s)s.cacheHits++;}
export function currentUsage(){const s=scope.getStore();return s?{traceId:s.traceId,calls:[...s.calls],cacheHits:s.cacheHits,knownCostRub:s.calls.reduce((sum,c)=>sum+(c.costRub||0),0),costComplete:s.calls.every(c=>c.costRub!==null)}:undefined;}
