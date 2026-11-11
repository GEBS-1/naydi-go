import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v);c=v.connect()
try:
 v.run(c,"""cd /var/www/naydi-app/current && node --input-type=module - <<'JS'
import {build} from 'esbuild';const b=await build({entryPoints:['lib/offer-extraction.ts'],bundle:true,write:false,platform:'node',format:'esm'});const {extractOffers}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const url='https://kazan.mehamalina.ru/man/zimniye-kozhanyye-kurtki',html=await(await fetch(url)).text();const offers=extractOffers(html,url,'Казань');const detail=await(await fetch(offers[0].site)).text();console.log('DETAIL_FACTS',detail.match(/.{0,120}(?:Артикул|Характеристик|Материал|Цвет|Модель|product-property|product-params|ratingValue).{0,250}/giu)?.slice(0,12));for(const h of offers.slice(0,2)){const r=await fetch(h.image,{signal:AbortSignal.timeout(10000)});console.log(JSON.stringify({title:h.title,image:h.image,status:r.status,type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength}));}console.log('IMAGE_MARKUP',html.match(/<img[^>]*itemprop=["']image["'][^>]*>/gi)?.slice(0,2));
JS""")
finally:c.close()
