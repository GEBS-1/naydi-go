import {z} from 'zod';
import type {Product} from './model';
import {normalize} from './search';

const text=z.string().trim().max(4000),short=z.string().trim().min(1).max(200);
export const productInputSchema=z.object({storeId:short,name:short,category:short,brand:text,model:text,description:text,features:text,price:z.number().min(0).max(1e9),quantity:z.number().int().min(0).max(1e7),sku:text,published:z.boolean(),photos:z.array(z.string().max(1000)).max(5),keywords:text,stockConfirmed:z.boolean().default(true)}).strict();
export type ProductInput=z.infer<typeof productInputSchema>;
export type ProductSourceType='manual'|'csv'|'xlsx'|'catalog'|'external';
export interface ProductCommandMeta {sourceType:ProductSourceType;sourceUrl?:string;checkedAt?:string}
export interface PreparedProduct {product:Product;normalizedName:string;sourceType:ProductSourceType;sourceUrl:string|null;checkedAt:number}

export function prepareProduct(inputValue:unknown,previous:Product|undefined,meta:ProductCommandMeta):PreparedProduct{
 const input=productInputSchema.parse(inputValue),sourceUrl=meta.sourceUrl?.trim()||previous?.sourceUrl||'';
 if(sourceUrl){const url=new URL(sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('Источник товара должен быть HTTPS URL.');}
 if(input.published&&!input.photos.length&&!sourceUrl&&!previous?.source&&!previous?.importedSource)throw Error('Для публикации добавьте фотографию или URL источника.');
 const checkedAt=meta.checkedAt||new Date().toISOString(),normalizedName=normalize(input.name),sourceType=meta.sourceType==='manual'&&previous?.sourceType?previous.sourceType:meta.sourceType;
 const product:Product={...previous,...input,id:previous?.id||crypto.randomUUID(),demo:previous?.demo||false,importedSource:previous?.importedSource||previous?.source||sourceUrl||undefined,importedCheckedAt:previous?.importedCheckedAt||(previous?.source?previous.checkedAt:checkedAt),source:undefined,checkedAt,priceFrom:false,normalizedName,sourceType,sourceUrl:sourceUrl||undefined};
 return {product,normalizedName,sourceType,sourceUrl:sourceUrl||null,checkedAt:Date.parse(checkedAt)||Date.now()};
}

export function productWrite(database:D1Database,prepared:PreparedProduct,exists:boolean){const {product,normalizedName,sourceType,sourceUrl,checkedAt}=prepared;return exists?database.prepare('UPDATE products SET published=?,data=?,normalized_name=?,source_type=?,source_url=?,checked_at=? WHERE id=? AND store_id=?').bind(+product.published,JSON.stringify(product),normalizedName,sourceType,sourceUrl,checkedAt,product.id,product.storeId):database.prepare('INSERT INTO products (id,store_id,published,data,normalized_name,source_type,source_url,checked_at) VALUES (?,?,?,?,?,?,?,?)').bind(product.id,product.storeId,+product.published,JSON.stringify(product),normalizedName,sourceType,sourceUrl,checkedAt);}
