import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile,unlink} from 'node:fs/promises';
import {build} from 'esbuild';
import * as XLSX from 'xlsx';

async function load(entry){
 const result=await build({entryPoints:[path.resolve(entry)],bundle:true,write:false,platform:'node',format:'esm',target:'node22',external:['cloudflare:workers','xlsx']});
 const output=path.resolve('scripts','.test-'+path.basename(entry,'.ts')+'-'+Date.now()+'.mjs');
 await writeFile(output,result.outputFiles[0].text);
 try{return await import(pathToFileURL(output).href)}finally{await unlink(output)}
}
const imports=await load('lib/import-contract.ts');
const commands=await load('lib/product-command.ts');
const drafts=await load('lib/product-draft-contract.ts');
const fake=(name,bytes)=>({name,size:bytes.byteLength,text:async()=>Buffer.from(bytes).toString('utf8'),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});

const csv=Buffer.from('\uFEFFНазвание;Цена;Остаток;Артикул\nДрель Makita;7490,50;3;D-1','utf8');
const table=await imports.readImportFile(fake('products.csv',csv));
assert.equal(table.format,'csv');
const mapping=imports.autoMapping(table.headers);
const preview=imports.buildImportPreview(table,mapping,{category:'Дом и ремонт',published:false});
assert.equal(preview.issues.length,0);
assert.deepEqual([preview.rows[0].name,preview.rows[0].price,preview.rows[0].quantity],['Дрель Makita',7490.5,3]);

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
const formPrepared=commands.prepareProduct({...input,id:'client-must-not-control-id',demo:true},undefined,{sourceType:'manual'});
assert.notEqual(formPrepared.product.id,'client-must-not-control-id');
assert.equal(formPrepared.product.demo,false);
assert.throws(()=>commands.prepareProduct({...input,published:true},undefined,{sourceType:'csv'}),/фотографию|источника/);

const allowed={name:'Дрель',category:'Дом и ремонт',brand:'',model:'',features:'',description:'Инструмент',keywords:'дрель'};
assert.deepEqual(drafts.productDraftSchema.parse(allowed),allowed);
assert.equal(drafts.productDraftSchema.safeParse({...allowed,price:1}).success,false);
assert.equal(drafts.productDraftSchema.safeParse({...allowed,quantity:99}).success,false);
console.log('PASS: CSV/XLSX preview, shared product command, normalization and AI draft field allowlist.');
