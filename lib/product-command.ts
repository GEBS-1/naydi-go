import type {Database} from '@/db/types';
import {z} from 'zod';
import type {Product} from './model';
import {normalize} from './search';

const text=z.string().trim().max(4000),short=z.string().trim().min(1).max(200);
// ProductForm edits the persisted Product shape, so legacy metadata such as
// id/demo can arrive with writable fields. Strip it and construct metadata on
// the server; spreadsheet rows use this same command path.
export const productInputSchema=z.object({
  priceMode:z.enum(['fixed','negotiable','free']).optional(),condition:z.enum(['new','used','unknown']).optional(),storeId:short,name:short,category:short,brand:text,model:text,description:text,features:text,
  price:z.number().min(0).max(1e9).nullable(),priceConfirmed:z.boolean().optional(),
  quantity:z.number().int().min(0).max(1e7).nullable(),sku:text,published:z.boolean(),
  photos:z.array(z.string().max(1000)).max(10),keywords:text,stockConfirmed:z.boolean().optional(),
  imageSource:z.union([z.literal(''),z.string().url().regex(/^https:\/\//)]).optional(),
  sourceUrl:z.union([z.literal(''),z.string().url().regex(/^https:\/\//)]).optional(),
  attributes:z.array(z.object({name:z.string().trim().min(1).max(80),value:z.string().trim().min(1).max(200)})).max(12).optional(),
  applications:z.string().trim().max(2000).optional(),
  barcode:z.string().trim().max(32).optional(),
  weightKg:z.number().min(0).max(10000).nullable().optional(),
  dimensions:z.object({lengthCm:z.number().min(0).max(10000).nullable().optional(),widthCm:z.number().min(0).max(10000).nullable().optional(),heightCm:z.number().min(0).max(10000).nullable().optional()}).optional(),
}).strip();
export type ProductInput=z.infer<typeof productInputSchema>;
export type ProductSourceType='manual'|'csv'|'xlsx'|'catalog'|'external';
export interface ProductCommandMeta {sourceType:ProductSourceType;sourceUrl?:string;checkedAt?:string}
export interface PreparedProduct {product:Product;normalizedName:string;sourceType:ProductSourceType;sourceUrl:string|null;checkedAt:number}

export function prepareProduct(inputValue:unknown,previous:Product|undefined,meta:ProductCommandMeta):PreparedProduct{
 const input=productInputSchema.parse(inputValue),sourceUrl=meta.sourceUrl?.trim()||input.sourceUrl?.trim()||previous?.sourceUrl||'';
 const priceConfirmed=input.priceConfirmed??previous?.priceConfirmed??Boolean(previous?.published&&input.price===previous.price),stockConfirmed=input.stockConfirmed??previous?.stockConfirmed??Boolean(previous?.published&&input.quantity===previous.quantity);
 if(sourceUrl){const url=new URL(sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('Источник товара должен быть HTTPS URL.');}
 if(input.published&&((input.price!==null&&!priceConfirmed)||(input.quantity!==null&&!stockConfirmed)))throw Error('Подтвердите заполненные цену и остаток магазина. Неизвестные значения оставьте пустыми.');
 if(input.published&&!input.photos.length&&!sourceUrl&&!previous?.source&&!previous?.importedSource)throw Error('Для публикации добавьте фотографию или URL источника.');
 const checkedAt=meta.checkedAt||new Date().toISOString(),normalizedName=normalize(input.name),sourceType=meta.sourceType==='manual'?(previous?.sourceType|| (input.sourceUrl?'catalog':'manual')):meta.sourceType;
 const product:Product={...previous,...input,priceConfirmed,stockConfirmed,id:previous?.id||crypto.randomUUID(),demo:previous?.demo||false,importedSource:previous?.importedSource||previous?.source||sourceUrl||undefined,importedCheckedAt:previous?.importedCheckedAt||(previous?.source?previous.checkedAt:checkedAt),source:undefined,checkedAt,priceFrom:false,normalizedName,sourceType,sourceUrl:sourceUrl||undefined};
 return {product,normalizedName,sourceType,sourceUrl:sourceUrl||null,checkedAt:Date.parse(checkedAt)||Date.now()};
}

export function productWrite(database:Database,prepared:PreparedProduct,exists:boolean){const {product,normalizedName,sourceType,sourceUrl,checkedAt}=prepared;return exists?database.prepare('UPDATE products SET published=?,data=?,normalized_name=?,source_type=?,source_url=?,checked_at=? WHERE id=? AND store_id=?').bind(+product.published,JSON.stringify(product),normalizedName,sourceType,sourceUrl,checkedAt,product.id,product.storeId):database.prepare('INSERT INTO products (id,store_id,published,data,normalized_name,source_type,source_url,checked_at) VALUES (?,?,?,?,?,?,?,?)').bind(product.id,product.storeId,+product.published,JSON.stringify(product),normalizedName,sourceType,sourceUrl,checkedAt);}
