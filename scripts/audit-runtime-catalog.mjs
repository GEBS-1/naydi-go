import {getServerEnv} from './naydi-node-env.mjs';
const db=getServerEnv().DB;
const stores=(await db.prepare('SELECT id,owner,data,visibility FROM shops ORDER BY id').all()).results.map(row=>{const data=JSON.parse(row.data);return {id:row.id,name:data.name,owner:!!row.owner,demo:data.demo===true,testOnly:data.testOnly===true,visibility:row.visibility};});
const products=(await db.prepare('SELECT id,store_id,data,published FROM products ORDER BY store_id,id').all()).results.map(row=>{const data=JSON.parse(row.data);return {id:row.id,storeId:row.store_id,name:data.name,demo:data.demo===true,testOnly:data.testOnly===true,published:row.published===1||row.published===true};});
const ids=new Set(['demo-s0','demo-s1','demo-s2']);
const targetStores=stores.filter(row=>ids.has(row.id));
const targetProducts=products.filter(row=>ids.has(row.storeId));
const relations={};
for(const [table,column,keys] of [['claims','store_id',targetStores.map(row=>row.id)],['inquiries','store_id',targetStores.map(row=>row.id)],['onboarding','store_id',targetStores.map(row=>row.id)],['owner_invites','store_id',targetStores.map(row=>row.id)],['preview_tokens','store_id',targetStores.map(row=>row.id)],['favorites','product_id',targetProducts.map(row=>row.id)]]){
 relations[table]=[];
 for(const id of keys){const row=await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`).bind(id).first();if(Number(row?.n||0))relations[table].push({id,count:Number(row.n)});}
}
console.log(JSON.stringify({scope:'configured PostgreSQL; read-only',totals:{stores:stores.length,products:products.length},stores,products,targetStores,targetProducts,relations},null,2));
