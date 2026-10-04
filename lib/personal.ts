import {z} from 'zod';
import type {ShoppingPlan} from './discovery';
const context=z.object({query:z.string().max(500),maxPrice:z.number().nonnegative().optional(),radiusKm:z.number().nonnegative().optional(),sort:z.enum(['relevance','price','price-distance']).optional(),newOnly:z.boolean().optional()});
const safeUrl=z.string().max(4000).refine(s=>/^https?:\/\//i.test(s)||/^#(?:product|store)\//.test(s));
const favorite=z.object({id:z.string().max(500),title:z.string().max(500),kind:z.enum(['product','store','service','page']),url:safeUrl,city:z.string().max(100),image:z.string().max(4000).optional(),price:z.number().nullable().optional(),checkedAt:z.string().optional()});
const search=z.object({id:z.string(),query:z.string().min(1).max(500),city:z.string().min(2).max(100),filter:z.string().max(30),context:context.optional(),at:z.number()});
const plan=z.object({id:z.string(),title:z.string().max(180),city:z.string().max(100),task:z.string().max(4000),items:z.array(z.object({id:z.string(),name:z.string().max(200),query:z.string().max(200),category:z.string().max(100),note:z.string().max(400),quantity:z.number().int().min(1).max(10000).optional(),selected:z.object({id:z.string().max(500),title:z.string().max(500),price:z.number().nonnegative().nullable(),source:z.string().url().refine(s=>/^https?:\/\//.test(s)),checkedAt:z.string().max(100)}).optional(),enabled:z.boolean()})).max(30),questions:z.array(z.string()),ai:z.boolean(),updatedAt:z.string()});
export const personalSchema=z.object({version:z.literal(1),favorites:z.array(favorite).max(500),searches:z.array(search).max(100),history:z.array(search).max(100),collections:z.array(plan).max(100)});
export type Favorite=z.infer<typeof favorite>;
export type SavedSearch=z.infer<typeof search>;
export type Personal=z.infer<typeof personalSchema>;
export const personalKey='ng_personal_v1',personalEvent='ng-personal-change';
// Explicit user-triggered merge. Never discard items silently or upload automatically.
export function mergePersonal(remote:Personal,local:Personal):Personal{
 const unique=<T,>(a:T[],b:T[],key:(v:T)=>string)=>Array.from(new Map([...a,...b].map(x=>[key(x),x])).values());
 const sk=(s:SavedSearch)=>JSON.stringify([s.query.trim().toLowerCase(),s.city.trim().toLowerCase(),s.filter,s.context||null]);
 return personalSchema.parse({version:1,favorites:unique(remote.favorites,local.favorites,x=>x.id),searches:unique(remote.searches,local.searches,sk),history:unique(remote.history,local.history,sk).sort((a,b)=>b.at-a.at).slice(0,100),collections:unique(remote.collections,local.collections,x=>x.id)});
}
export function emptyPersonal():Personal{return {version:1,favorites:[],searches:[],history:[],collections:[]};}
export function readPersonal():Personal{if(typeof window==='undefined')return emptyPersonal();try{const raw=localStorage.getItem(personalKey);return raw?personalSchema.parse(JSON.parse(raw)):emptyPersonal();}catch{return emptyPersonal();}}
export function updatePersonal(change:(p:Personal)=>Personal){let current:Personal;try{const raw=localStorage.getItem(personalKey);current=raw?personalSchema.parse(JSON.parse(raw)):emptyPersonal();}catch{throw Error('Сохранения недоступны или имеют неизвестный формат. Исходные данные не изменены.');}const next=personalSchema.parse(change(current));try{localStorage.setItem(personalKey,JSON.stringify(next));}catch{throw Error('Не удалось сохранить на устройстве: хранилище недоступно или заполнено.');}window.dispatchEvent(new Event(personalEvent));return next;}
export function toggleFavorite(item:Favorite){return updatePersonal(p=>({...p,favorites:p.favorites.some(f=>f.id===item.id)?p.favorites.filter(f=>f.id!==item.id):[item,...p.favorites]}));}
export function rememberSearch(value:Omit<SavedSearch,'id'|'at'>,saved=false){const item={...value,id:crypto.randomUUID(),at:Date.now()};return updatePersonal(p=>{const key=saved?'searches':'history';const equal=(x:SavedSearch)=>x.query===item.query&&x.city===item.city&&x.filter===item.filter&&JSON.stringify(x.context)===JSON.stringify(item.context);return {...p,[key]:[item,...p[key].filter(x=>!equal(x))].slice(0,100)};});}
export function keepPlan(value:ShoppingPlan){return updatePersonal(p=>({...p,collections:[value,...p.collections.filter(x=>x.id!==value.id)].slice(0,100)}));}
// Pending replay contains constraints, never old results or precise coordinates.
export function replaySearch(value:SavedSearch){localStorage.setItem('ng_city',value.city);sessionStorage.setItem('ng_current_city',value.city);sessionStorage.setItem('ng_replay_search',JSON.stringify(value));sessionStorage.removeItem('ng_search_context');location.hash='search/'+encodeURIComponent(value.query);}
export function takeReplay(){try{const raw=sessionStorage.getItem('ng_replay_search');sessionStorage.removeItem('ng_replay_search');return raw?search.parse(JSON.parse(raw)):null;}catch{return null;}}
