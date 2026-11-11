"""Inspect published merchant markup through the existing robots-aware parser."""
import importlib.util,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace');s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v);c=v.connect()
try:
 v.run(c,"""cd /var/www/naydi-app/current && node --input-type=module - <<'JS'
import {build} from 'esbuild';
async function load(entry){const b=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));}
const {fetchSource,robotsAllowed}=await load('lib/source-fetch.ts'),{extractOffers,jsonLD}=await load('lib/offer-extraction.ts'),{microdata}=await load('lib/microdata.ts');const url='https://kazan.mehamalina.ru/man/zimniye-kozhanyye-kurtki';
const html=await fetchSource(url);console.log('ROBOTS_AWARE_HTML',html?.length||0);
if(html){const offers=extractOffers(html,url,'Казань');console.log('EXTRACTED',JSON.stringify({count:offers.length,sample:offers.slice(0,3).map(h=>({title:h.title,price:h.price,image:h.image,source:h.source,kind:h.kind}))}));const nodes=microdata(html);console.log('MICRODATA',JSON.stringify(nodes.slice(0,3)));console.log('LD_TYPES',JSON.stringify(jsonLD(html).map(n=>n['@type']).filter(Boolean).slice(0,10)));}
const robots=await(await fetch('https://kazan.mehamalina.ru/robots.txt')).text();console.log('ROBOTS_PERMITS_CATALOG',robotsAllowed(robots,new URL(url).pathname));
JS""")
finally:c.close()
