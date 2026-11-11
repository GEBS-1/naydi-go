import {db} from '@/db';
import {onMap} from '@/lib/discovery';
import {cityKey} from '@/lib/location';
import type {Product,Shop} from '@/lib/model';

const maxListings=400;

export async function GET(req:Request){
 const city=new URL(req.url).searchParams.get('city')?.trim()||'';
 if(city.length<2||city.length>100)return Response.json({error:'Выберите город.'},{status:400});
 try{
  const {results}=await db().prepare(`SELECT p.data AS product,s.data AS shop
   FROM products p JOIN shops s ON s.id=p.store_id
   WHERE p.published=1 AND s.visibility='public' AND s.owner IS NOT NULL
    AND p.source_type='manual' AND COALESCE(p.source_url,'')=''
    AND COALESCE(json_extract(p.data,'$.source'),'')=''
    AND COALESCE(json_extract(p.data,'$.importedSource'),'')=''
    AND COALESCE(json_extract(p.data,'$.demo'),0)=0
    AND COALESCE(json_extract(p.data,'$.testOnly'),0)=0
    AND COALESCE(json_extract(s.data,'$.demo'),0)=0
    AND COALESCE(json_extract(p.data,'$.quantity'),'-1')<>'0'
    AND COALESCE(json_extract(p.data,'$.kind'),'product')='product'
    AND json_extract(s.data,'$.addressConfirmed')='true'
    AND replace(lower(trim(json_extract(s.data,'$.city'))),'ё','е')=?
   ORDER BY p.rowid DESC LIMIT ?`).bind(cityKey(city),maxListings+1).all<{product:string;shop:string}>();
  const stores=new Map<string,Pick<Shop,'id'|'name'|'city'|'street'|'lat'|'lng'|'addressConfirmed'|'category'>>();
  const products=results.slice(0,maxListings).flatMap(row=>{
   const shop=JSON.parse(row.shop) as Shop,product=JSON.parse(row.product) as Product;
   if(!onMap(shop))return [];
   const {id,name,city,street,lat,lng,addressConfirmed,category}=shop;
   stores.set(id,{id,name,city,street,lat,lng,addressConfirmed,category});
   return [{id:product.id,shopId:id,title:product.name,price:product.price,image:product.photos?.[0]||null}];
  });
  return Response.json({stores:[...stores.values()],products,limited:results.length>maxListings},{headers:{'Cache-Control':'no-store'}});
 }catch{
  return Response.json({error:'Не удалось загрузить объявления. Попробуйте ещё раз.'},{status:503});
 }
}
