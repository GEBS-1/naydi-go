import {categories} from './model';

export type ImportFormat='csv'|'xlsx';
export const importFields=['name','category','brand','model','description','features','price','quantity','sku','keywords','imageUrls','sourceUrl','published'] as const;
export type ImportField=typeof importFields[number];
export type ColumnMapping=Record<ImportField,number|null>;
export interface ImportRow {name:string;category:string;brand:string;model:string;description:string;features:string;price:number;quantity:number;sku:string;keywords:string;imageUrls:string[];sourceUrl:string;published:boolean}
export interface ImportIssue {row:number;field:keyof ImportRow;message:string}
export interface ImportPreview {format:ImportFormat;rows:ImportRow[];issues:ImportIssue[];totalRows:number}
export interface ImportTable {format:ImportFormat;headers:string[];rows:string[][]}

const aliases:Record<ImportField,string[]>={
 name:['name','title','product','product name','название','товар','наименование'],category:['category','категория'],brand:['brand','бренд','марка'],model:['model','модель'],description:['description','описание'],features:['features','specifications','characteristics','характеристики','свойства'],price:['price','cost','цена','стоимость'],quantity:['quantity','stock','qty','остаток','количество'],sku:['sku','article','vendor code','артикул','код'],keywords:['keywords','tags','ключевые слова','теги'],imageUrls:['images','image','photos','photo','фото','изображения'],sourceUrl:['source url','url','link','ссылка','источник'],published:['published','publish','active','опубликован','публиковать']
};
const clean=(value:unknown)=>String(value??'').replace(/^\uFEFF/,'').replace(/\s+/g,' ').trim();
const key=(value:string)=>clean(value).toLowerCase().replace(/[_-]+/g,' ');
export function emptyMapping():ColumnMapping{return Object.fromEntries(importFields.map(field=>[field,null])) as unknown as ColumnMapping;}
export function autoMapping(headers:string[]):ColumnMapping{const mapping=emptyMapping();for(const field of importFields){const index=headers.findIndex(header=>aliases[field].includes(key(header)));if(index>=0)mapping[field]=index;}return mapping;}
function decimal(value:string){const normalized=value.replace(/[\s ₽$]/g,'').replace(',','.');return normalized&&/^-?\d+(?:\.\d+)?$/.test(normalized)?Number(normalized):NaN;}
function boolean(value:string,fallback:boolean){if(!value)return fallback;const v=key(value);if(['1','true','yes','y','да','опубликован','активен'].includes(v))return true;if(['0','false','no','n','нет','черновик','скрыт'].includes(v))return false;return fallback;}
function urls(value:string){return value.split(/[;,\n]+/).map(clean).filter(Boolean).slice(0,5);}
function validURL(value:string){if(!value)return true;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
export function buildImportPreview(table:ImportTable,mapping:ColumnMapping,defaults:{category:string;published:boolean}):ImportPreview{
 const rows:ImportRow[]=[],issues:ImportIssue[]=[];
 const get=(row:string[],field:ImportField)=>mapping[field]===null?'':clean(row[mapping[field]!]);
 table.rows.slice(0,500).forEach((raw,index)=>{
  const rowNumber=index+2,price=decimal(get(raw,'price')),quantity=decimal(get(raw,'quantity'));
  const row:ImportRow={name:get(raw,'name'),category:get(raw,'category')||defaults.category,brand:get(raw,'brand'),model:get(raw,'model'),description:get(raw,'description'),features:get(raw,'features'),price,quantity,sku:get(raw,'sku'),keywords:get(raw,'keywords'),imageUrls:urls(get(raw,'imageUrls')),sourceUrl:get(raw,'sourceUrl'),published:boolean(get(raw,'published'),defaults.published)};
  if(!row.name||row.name.length>200)issues.push({row:rowNumber,field:'name',message:'Укажите название до 200 символов'});
  if(!categories.includes(row.category as typeof categories[number]))issues.push({row:rowNumber,field:'category',message:'Выберите одну из категорий НайдиGo'});
  if(!Number.isFinite(row.price)||row.price<0||row.price>1e9)issues.push({row:rowNumber,field:'price',message:'Цена должна быть числом от 0'});
  if(!Number.isInteger(row.quantity)||row.quantity<0||row.quantity>1e7)issues.push({row:rowNumber,field:'quantity',message:'Остаток должен быть целым числом от 0'});
  if(row.sourceUrl&&!validURL(row.sourceUrl))issues.push({row:rowNumber,field:'sourceUrl',message:'Источник должен быть HTTPS URL'});
  for(const image of row.imageUrls)if(!validURL(image))issues.push({row:rowNumber,field:'imageUrls',message:'Фото должно быть HTTPS URL'});
  if(row.published&&!row.imageUrls.length&&!row.sourceUrl)issues.push({row:rowNumber,field:'published',message:'Для публикации нужно фото или URL источника'});
  rows.push(row);
 });
 if(table.rows.length>500)issues.push({row:502,field:'name',message:'За один импорт обрабатываются первые 500 строк'});
 return {format:table.format,rows,issues,totalRows:table.rows.length};
}
function parseCSV(text:string){const first=(text.split(/\r?\n/,1)[0]||''),delimiter=(first.match(/;/g)?.length||0)>(first.match(/,/g)?.length||0)?';':',';const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(char===delimiter&&!quoted){row.push(cell);cell='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>clean(value)))rows.push(row);row=[];cell='';}else cell+=char;}row.push(cell);if(row.some(value=>clean(value)))rows.push(row);return rows;}
export async function readImportFile(file:File):Promise<ImportTable>{
 if(file.size>5*1024*1024)throw Error('Файл должен быть меньше 5 МБ.');
 const extension=file.name.split('.').pop()?.toLowerCase();let matrix:string[][],format:ImportFormat;
 if(extension==='csv'){format='csv';matrix=parseCSV(await file.text());}
 else if(extension==='xlsx'){format='xlsx';const XLSX=await import('xlsx');const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const first=workbook.SheetNames[0];if(!first)throw Error('В Excel-файле нет листов.');matrix=(XLSX.utils.sheet_to_json(workbook.Sheets[first],{header:1,raw:false,defval:''}) as unknown[][]).map(row=>row.map(clean));}
 else throw Error('Поддерживаются CSV и XLSX.');
 if(matrix.length<2)throw Error('В файле нужны строка заголовков и хотя бы один товар.');
 const headers=matrix[0].slice(0,50).map((header,index)=>clean(header)||`Колонка ${index+1}`);return {format,headers,rows:matrix.slice(1).map(row=>row.slice(0,50))};
}
