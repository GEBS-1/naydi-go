import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile,unlink} from 'node:fs/promises';
import {build} from 'esbuild';
import * as XLSX from 'xlsx';

async function load(entry){
 const result=await build({entryPoints:[path.resolve(entry)],bundle:true,write:false,platform:'node',format:'esm',target:'node22',external:['@/lib/server-env','xlsx']});
 const output=path.resolve('scripts','.test-'+path.basename(entry,'.ts')+'-'+Date.now()+'.mjs');
 await writeFile(output,result.outputFiles[0].text);
 try{return await import(pathToFileURL(output).href)}finally{await unlink(output)}
}
async function loadPhotoProviderWithMockRouter(){
 const result=await build({entryPoints:[path.resolve('lib/product-draft-provider.ts')],bundle:true,write:false,platform:'node',format:'esm',target:'node22',plugins:[{name:'qa-photo-provider-mock',setup(build){
  build.onResolve({filter:/^@\/lib\/server-env$/},()=>({path:'env',namespace:'qa-mock'}));
  build.onResolve({filter:/^\.\/router-gateway$/},args=>path.basename(args.importer)==='product-draft-provider.ts'?{path:'router',namespace:'qa-mock'}:undefined);
  build.onLoad({filter:/.*/,namespace:'qa-mock'},args=>({loader:'js',contents:args.path==='env'
   ?'export const env={ROUTERAI_VISION_MODEL:"qwen/qwen3-vl-8b-instruct"};'
   :'export async function routerCall(body){globalThis.__qaRouterRequest=body;return {choices:[{message:{content:JSON.stringify({name:"Аккумуляторная дрель",category:"Дом и ремонт",brand:"Bosch",model:"GSR",description:"Аккумуляторная дрель для монтажных работ.",features:"Напряжение: 18 В",attributes:[{name:"Напряжение",value:"18 В"}],applications:"Сверление и закручивание крепежа",keywords:"дрель шуруповерт bosch",barcode:"",weightKg:null,dimensions:{lengthCm:null,widthCm:null,heightCm:null},suggestions:{use:"для монтажных работ",size:"18 В"}})}}]}};'}));
 }}]});
 const output=path.resolve('scripts','.test-photo-provider-'+Date.now()+'.mjs');
 await writeFile(output,result.outputFiles[0].text);
 try{return await import(pathToFileURL(output).href)}finally{await unlink(output)}
}
const imports=await load('lib/import-contract.ts');
const commands=await load('lib/product-command.ts');
const drafts=await load('lib/product-draft-contract.ts');
const sources=await load('lib/source-fetch.ts');
const offers=await load('lib/offer-extraction.ts');
const fake=(name,bytes)=>({name,size:bytes.byteLength,text:async()=>Buffer.from(bytes).toString('utf8'),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});

const csv=Buffer.from('\uFEFFНазвание;Цена;Остаток;Артикул\nДрель Makita;7490,50;3;D-1','utf8');
const table=await imports.readImportFile(fake('products.csv',csv));
assert.equal(table.format,'csv');
const mapping=imports.autoMapping(table.headers);
const preview=imports.buildImportPreview(table,mapping,{category:'Дом и ремонт',published:false});
assert.equal(preview.issues.length,0);
assert.deepEqual([preview.rows[0].name,preview.rows[0].price,preview.rows[0].quantity],['Дрель Makita',7490.5,3]);
const sparse=await imports.readImportFile(fake('assortment.csv',Buffer.from('Название;Описание\nКрепёжный набор;Для монтажа полок','utf8')));
const sparsePreview=imports.buildImportPreview(sparse,imports.autoMapping(sparse.headers),{category:'Дом и ремонт',published:false});
assert.equal(sparsePreview.issues.length,0);
assert.deepEqual([sparsePreview.rows[0].price,sparsePreview.rows[0].quantity],[null,null]);

const workbook=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Товар','Стоимость','Количество'],['Корм для собак',1200,5]]),'Товары');
const xlsx=Buffer.from(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}));
const excel=await imports.readImportFile(fake('products.xlsx',xlsx));
const excelPreview=imports.buildImportPreview(excel,imports.autoMapping(excel.headers),{category:'Зоотовары',published:false});
assert.equal(excelPreview.issues.length,0);
assert.equal(excelPreview.rows[0].price,1200);

const input={storeId:'store-1',name:'Дрель Makita DDF485',category:'Дом и ремонт',brand:'Makita',model:'DDF485',description:'Аккумуляторная дрель',features:'18 В',price:12990,quantity:2,sku:'DDF485',published:false,photos:[],keywords:'дрель шуруповерт',stockConfirmed:true};
const prepared=commands.prepareProduct(input,undefined,{sourceType:'xlsx',sourceUrl:'https://seller.example/product'});
assert.equal(prepared.product.price,12990);
assert.equal(prepared.product.quantity,2);
assert.equal(prepared.product.normalizedName,'дрель makita ddf485');
assert.equal(prepared.product.sourceType,'xlsx');
const catalogHtml='<article class="good js-good" data-name="Набор сверл QA" data-price="1490" data-stock="1"><a href="/shop/drills/qa.html" class="good__img-wrap"><img src="/images/qa-drills.webp"></a></article>';
const [catalogOffer]=offers.extractOffers(catalogHtml,'https://kazan.tatmetiz.ru/shop/drills/','Казань');
const importedCatalogProduct=commands.prepareProduct({storeId:'store-1',name:catalogOffer.title,category:'Дом и ремонт',brand:'',model:'',description:catalogOffer.description||'',features:'',price:catalogOffer.price,quantity:null,sku:'',published:false,photos:catalogOffer.image?[catalogOffer.image]:[],keywords:catalogOffer.title},undefined,{sourceType:'catalog',sourceUrl:catalogOffer.site,checkedAt:catalogOffer.checkedAt});
assert.deepEqual([importedCatalogProduct.product.name,importedCatalogProduct.product.price,importedCatalogProduct.product.quantity,importedCatalogProduct.product.photos[0],importedCatalogProduct.product.sourceUrl,importedCatalogProduct.product.published],['Набор сверл QA',1490,null,'https://kazan.tatmetiz.ru/images/qa-drills.webp','https://kazan.tatmetiz.ru/shop/drills/qa.html',false]);
assert.equal(importedCatalogProduct.product.stockConfirmed,false,'website stock must not become a confirmed branch quantity');
const formPrepared=commands.prepareProduct({...input,id:'client-must-not-control-id',demo:true},undefined,{sourceType:'manual'});
assert.notEqual(formPrepared.product.id,'client-must-not-control-id');
assert.equal(formPrepared.product.demo,false);
assert.throws(()=>commands.prepareProduct({...input,published:true},undefined,{sourceType:'csv'}),/подтвердите .*цену и остаток/i);
assert.throws(()=>commands.prepareProduct({...input,published:true,priceConfirmed:true,stockConfirmed:false},undefined,{sourceType:'csv'}),/подтвердите .*цену и остаток/i);
assert.throws(()=>commands.prepareProduct({...input,published:true,priceConfirmed:true,stockConfirmed:true},undefined,{sourceType:'csv'}),/фотографию|источника/);
const unknown=commands.prepareProduct({...input,price:null,quantity:null,stockConfirmed:false},undefined,{sourceType:'manual'});
assert.equal(unknown.product.price,null);assert.equal(unknown.product.quantity,null);assert.equal(unknown.product.priceConfirmed,false);
const photoDraft=commands.prepareProduct({...input,price:null,priceConfirmed:false,quantity:null,stockConfirmed:false,photos:['/api/photos/00000000-0000-0000-0000-000000000000']},undefined,{sourceType:'manual'});
assert.equal(photoDraft.product.published,false);assert.equal(photoDraft.product.price,null);assert.equal(photoDraft.product.quantity,null);
assert.equal(commands.prepareProduct({...input,sourceUrl:'https://seller.example/item'},undefined,{sourceType:'manual'}).product.sourceType,'catalog');
const unknownPublic=commands.prepareProduct({...input,price:null,quantity:null,stockConfirmed:false,published:true,sourceUrl:'https://seller.example/item'},undefined,{sourceType:'manual'});
assert.equal(unknownPublic.product.published,true);assert.equal(unknownPublic.product.price,null);assert.equal(unknownPublic.product.quantity,null);
assert.doesNotThrow(()=>commands.prepareProduct({...input,priceConfirmed:true,quantity:null,stockConfirmed:false,published:true,sourceUrl:'https://seller.example/item'},undefined,{sourceType:'manual'}));
const published={...input,published:true,priceConfirmed:true,stockConfirmed:true,photos:['/api/photos/00000000-0000-0000-0000-000000000000']};
assert.throws(()=>commands.prepareProduct({...published,price:14000,priceConfirmed:false},published,{sourceType:'manual'}),/подтвердите .*цену и остаток/i);
assert.equal(commands.prepareProduct({...published,description:'Обновлённое описание'},published,{sourceType:'manual'}).product.priceConfirmed,true);
assert.equal(sources.merchantSource('https://shop.example/catalog/item')?.hostname,'shop.example');
for(const unsafe of ['http://shop.example/item','https://127.0.0.1/item','https://localhost/item','https://shop.example:8443/item'])assert.equal(sources.merchantSource(unsafe),null);

const allowed={name:'Дрель',category:'Дом и ремонт',brand:'',model:'',features:'',description:'Инструмент',keywords:'дрель'};
assert.deepEqual(drafts.productDraftSchema.parse(allowed),{...allowed,applications:'',attributes:[]});
assert.equal(drafts.productDraftSchema.safeParse({...allowed,price:1}).success,false);
assert.equal(drafts.productDraftSchema.safeParse({...allowed,quantity:99}).success,false);
const coerced=drafts.coerceProductDraft({name:'Смеситель Grohe',category:'Сантехника',brand:'Grohe',model:'Atrio',description:'Для раковины',features:'Цвет: хром\nТип: однорычажный',keywords:'смеситель',attributes:[{name:'Цвет',value:'хром'}],price:999,sku:'X'});
assert.equal(coerced.category,'Дом и ремонт');
assert.equal(coerced.attributes[0].value,'хром');
assert.equal('price' in coerced,false);
const session=drafts.buildDraftSession({name:'Анкер оконный',category:'Дом и ремонт',brand:'',description:'Крепёж',features:'',keywords:'анкер',suggestions:{size:'10×132',use:'монтаж оконного профиля'}});
assert.ok(session.questions.some(q=>q.key==='use'));
assert.ok(session.questions.some(q=>q.key==='size'));
assert.equal(session.questions.find(q=>q.key==='use')?.suggested,'монтаж оконного профиля');
const provider=await loadPhotoProviderWithMockRouter();
const image='data:image/png;base64,aGVsbG8=';
const photoSession=await new provider.RouterAIProductDraftProvider().fromDescription({image,shopCategory:'Дом и ремонт',shopName:'QA магазин'});
const routerRequest=globalThis.__qaRouterRequest;
assert.equal(routerRequest.model,'qwen/qwen3-vl-8b-instruct');
assert.equal(routerRequest.max_tokens,1600);
assert.deepEqual(routerRequest.messages[1].content[1],{type:'image_url',image_url:{url:image}});
assert.match(routerRequest.messages[1].content[0].text,/QA магазин/);
assert.equal(photoSession.draft.name,'Аккумуляторная дрель');
assert.equal('price' in photoSession.draft,false);
assert.equal('quantity' in photoSession.draft,false);
delete globalThis.__qaRouterRequest;
const withApps=commands.prepareProduct({...input,applications:'монтаж окон, крепление к бетону'},undefined,{sourceType:'manual'});
assert.equal(withApps.product.applications,'монтаж окон, крепление к бетону');
console.log('PASS: CSV/XLSX preview, shared product command, normalization, photo AI adapter contract (mocked provider; no paid call), draft session and applications.');
