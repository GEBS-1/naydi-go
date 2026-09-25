import {readFile,mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.LOCAL_ORIGIN||'http://localhost:3000';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Этот импорт разрешён только в локальное приложение.');
const headers={'Content-Type':'application/json',Cookie:'__sites_local_auth=1'};
async function api(action,extra={}){const r=await fetch(origin+'/api/onboarding',{method:'POST',headers,body:JSON.stringify({action,...extra})});const b=await r.json();if(!r.ok)throw new Error(b.error);return b;}
const r=await fetch(origin+'/api/onboarding',{headers});const existing=await r.json();if(!r.ok)throw new Error('Включите ADMIN_EMAIL=seedy@sites.test и запустите npm run dev.');
const source=JSON.parse(await readFile(new URL('../data/kazan-onboarding.json',import.meta.url),'utf8'));
const report=[];
for(const entry of source.shops){let shop=existing.shops.find(s=>s.site===entry.shop.site);if(shop&&(shop.visibility!=='draft'||shop.hasOwner))throw new Error('Импорт не меняет опубликованные или переданные магазины: '+shop.name);
 const id=shop?.id||(await api('save',{data:entry.shop})).id;
 const previous=existing.products.filter(p=>p.storeId===id);
 for(const product of entry.products){if(!previous.some(p=>p.name===product.name&&p.source===product.source))await api('product',{id,data:product});}
 // Generating a new report deliberately rotates preview links; imported records are not overwritten.
 const preview=await api('preview',{id});
 const current=await (await fetch(origin+'/api/preview/'+preview.path.split('/').pop())).json();
 report.push({id,name:entry.shop.name,products:current.products.length,url:origin+preview.path,expiresAt:preview.expiresAt,source:entry.shop.source});
 console.log(entry.shop.name+': '+current.products.length+' товаров, '+origin+preview.path);
}
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/local-previews.json',import.meta.url),JSON.stringify(report,null,2));
await writeFile(new URL('../artifacts/LOCAL-PREVIEWS.md',import.meta.url),'# Личные витрины НайдиGo\n\nСекретные ссылки. Не публиковать. Новая генерация отзывает предыдущие.\n\n'+report.map(s=>`- [${s.name}](${s.url}) — ${s.products} товаров, действует до ${s.expiresAt}. Источник: ${s.source}`).join('\n'));
console.log('Отчёт: artifacts/LOCAL-PREVIEWS.md');
