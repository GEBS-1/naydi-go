import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
// Pure search module has only type imports; transpile for Node without a TS runner.
const source=await readFile(new URL('../lib/search.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {rankSearch}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const rows=[{id:'1',name:'Компрессор автомобильный',category:'Автотовары',description:'Насос для шин',features:'12 В',keywords:'насос',brand:'Тест',model:'A'},{id:'2',name:'Беспроводные наушники',category:'Электроника',description:'Гарнитура',features:'Bluetooth 5.3',keywords:'',brand:'Тест',model:'B'}];
assert.equal(rankSearch(rows,'компресс')[0].id,'1');assert.equal(rankSearch(rows,'насос для машины')[0].id,'1');assert.equal(rankSearch(rows,'Bluetooth')[0].id,'2');assert.equal(rankSearch(rows,'электроника')[0].id,'2');assert.equal(rankSearch(rows,'неизвестныйтелепорт').length,0);assert.equal(rankSearch(rows,'').length,2);console.log('PASS: partial, synonyms, category, characteristics, empty query and no fabricated results.');
