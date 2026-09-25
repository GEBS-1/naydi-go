import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {projectRoot} from './sites-env.mjs';
import path from 'node:path';
process.env.XDG_CONFIG_HOME ||= path.join(projectRoot,'.sites-runtime','xdg-config');
if(!existsSync(path.join(projectRoot,'dist/server/wrangler.json')))throw new Error('Сначала выполните npm run build');
const prefix=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--json'];
function execute(args){const r=spawnSync(process.execPath,[...prefix,...args],{cwd:projectRoot,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout);return JSON.parse(r.stdout)}
const tables=execute(['--command',"SELECT name FROM sqlite_master WHERE type='table'"])[0].results;
if(!tables.some(t=>t.name==='shops')){execute(['--file','drizzle/0000_dusty_prima.sql']);console.log('Применена миграция 0000');}
const columns=execute(['--command','PRAGMA table_info(shops)'])[0].results;
if(!columns.some(c=>c.name==='visibility')){execute(['--file','drizzle/0001_slow_ender_wiggin.sql']);console.log('Применена миграция 0001');}
if(!tables.some(t=>t.name==='shopping_plans')){execute(['--file','drizzle/0002_redundant_smiling_tiger.sql']);console.log('Применена миграция 0002');}
if(!tables.some(t=>t.name==='external_places')){execute(['--file','drizzle/0003_minor_spot.sql']);console.log('Применена миграция 0003');}
if(!tables.some(t=>t.name==='api_budget')){execute(['--file','drizzle/0004_acoustic_stepford_cuckoos.sql']);console.log('Применена миграция 0004');}
console.log('Локальная база готова. Данные сохранены в .wrangler/state. Запустите npm run dev.');
