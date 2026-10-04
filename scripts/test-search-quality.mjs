import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const url=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const {journeyIntent}=await import(url(await readFile('lib/journey-intent.ts','utf8')));
const {purchaseFocus}=await import(url(await readFile('lib/purchase-query.ts','utf8')));
assert.equal(purchaseFocus('сверло по бетону'),null);
assert.equal(purchaseFocus('чем просверлить бетон')?.query,'перфоратор для бетона');
for(const query of ['Найди цветы по дороге в Дербышки','Еду в Дербышки, найди цветы','Найди цветы в сторону района Дербышки']){const r=journeyIntent(query);assert.equal(r.destination,'Дербышки');assert.match(r.query,/цветы/);assert(!r.query.includes('Дербышки'));}
const search=url(await readFile('lib/search.ts','utf8'));
const relevance=(await readFile('lib/offer-relevance.ts','utf8')).replace("'./search'",JSON.stringify(search));
const {relevantOffers}=await import(url(relevance));
const items=[{kind:'product',title:'Кружка красно-черная',description:''},{kind:'product',title:'Кружка зеленая',description:''},{kind:'product',title:'Гель для стирки красного белья',description:''}];
assert.deepEqual(relevantOffers(items,'красная кружка','Казань').map(h=>h.title),['Кружка красно-черная']);
assert.equal(relevantOffers([{kind:'page',source:'https://detmir.kz/product/1'}],'подарок','Казань').length,0);
const pages=[
 {kind:'page',title:'Как заменить свечи Toyota RAV4 своими руками',description:'Пошаговая инструкция',source:'https://example.ru/articles/zamena-svechey'},
 {kind:'page',title:'Свечная головка 16 мм купить',description:'Каталог продавца',source:'https://example.ru/product/svechnaya-golovka'},
 {kind:'product',title:'Головка свечная 16 мм магнитная',description:'Инструмент для свечей',source:'https://example.ru/product/1'},
 {kind:'product',title:'Комплект свечей зажигания Toyota',description:'4 штуки',source:'https://example.ru/product/2'}
];
const focused=relevantOffers(pages,'свечной ключ или свечная головка для Toyota RAV4 2017 года','Казань');
assert.deepEqual(focused.map(h=>h.title),['Свечная головка 16 мм купить','Головка свечная 16 мм магнитная']);
console.log('PASS: unrelated items, foreign storefronts and informational articles are excluded; automotive tool search does not return spark plugs.');
