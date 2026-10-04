// Only explicitly reviewed public seller hosts can be fetched. Unknown search URLs
// remain clickable sources. This prevents search snippets/LLM output becoming an SSRF proxy.
const hosts=['kazan.gomeovet.ru','kazan.zapovednik96.ru','kzn.dogeat.ru','leogang.ru','velosky.ru','kzn.velo-shop.ru','kaz.android-market.net','kazan-mall.istudio-kazan.ru','kazan.richfamily.ru','kazan.shinservice.ru','detmir.ru','www.detmir.ru','kazan.detmir.ru','poryadok.ru','kazan.poryadok.ru','www.vseinstrumenti.ru','kazan.vseinstrumenti.ru','www.220-volt.ru','www.toy.ru','toy.ru','www.igromagazin.ru','igromagazin.ru','www.labirint.ru','www.chitai-gorod.ru','kazan.lemanapro.ru','lemanapro.ru','www.mvideo.ru','www.dns-shop.ru',
 'megakrepezh.ru','www.megakrepezh.ru','kazan.tatmetiz.ru','kazan.novocraft.ru','skskazan.ru','www.skskazan.ru','autocraft-kzn.ru','www.autocraft-kzn.ru','virage-kzn.ru','www.virage-kzn.ru','gazzap116.ru','www.gazzap116.ru','maikorcos.com','www.maikorcos.com','koreavisage.ru','www.koreavisage.ru','makpets.ru','www.makpets.ru','biosfera-kazan.ru','www.biosfera-kazan.ru'];
export function allowedSource(raw:string){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.includes(u.hostname)&&!u.hash?u:null;}catch{return null;}}
// Used only after an administrator has reviewed a merchant application.
// Unknown URLs never reach this path from public search requests.
export function merchantSource(raw:string){try{const u=new URL(raw),host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||host.includes(':')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||!host.includes('.'))return null;return u;}catch{return null;}}
export function robotsAllowed(body:string,path:string){
 type Rule={allow:boolean;path:string};
 const groups:{agents:string[];rules:Rule[]}[]=[];let group:{agents:string[];rules:Rule[]}|null=null,hasDirectives=false;
 for(const raw of body.split(/\r?\n/)){
  const line=raw.split('#')[0].trim(),colon=line.indexOf(':');if(colon<0)continue;
  const key=line.slice(0,colon).toLowerCase(),value=line.slice(colon+1).trim();
  if(key==='user-agent'){
   if(!group||hasDirectives){group={agents:[],rules:[]};groups.push(group);hasDirectives=false;}
   group.agents.push(value.toLowerCase());
  }else if(group){hasDirectives=true;if(['allow','disallow'].includes(key)&&value)group.rules.push({allow:key==='allow',path:value});}
 }
 const specific=groups.filter(g=>g.agents.includes('naydigo'));
 const rules=(specific.length?specific:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules);
 const matches=rules.filter(r=>{const pattern=r.path.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$');return new RegExp('^'+pattern).test(path);}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return matches[0]?.allow??true;
}
async function bounded(response:Response,max:number){if(!response.body)throw Error('empty');const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,out='';for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();throw Error('too-large');}out+=decoder.decode(value,{stream:true});}return out+decoder.decode();}
const robotsCache=new Map<string,{body:string|null,at:number}>();
export async function fetchSource(raw:string):Promise<string|null>{const url=allowedSource(raw);if(!url)return null;const init={redirect:'manual' as const,signal:AbortSignal.timeout(4000),headers:{'User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)','Accept':'text/html,text/plain'}};
 try{let cached=robotsCache.get(url.origin);if(!cached||Date.now()-cached.at>3600000){const robots=await fetch(url.origin+'/robots.txt',init);const body=robots.status===404?null:robots.ok?await bounded(robots,128000):'User-agent: *\nDisallow: /';cached={body,at:Date.now()};robotsCache.set(url.origin,cached);}if(cached.body!==null&&!robotsAllowed(cached.body,url.pathname+url.search))return null;
 const r=await fetch(url, {...init,signal:AbortSignal.timeout(4000)});if(!r.ok||!r.headers.get('content-type')?.includes('text/html')||/noindex|noarchive|nosnippet/i.test(r.headers.get('x-robots-tag')||''))return null;
 const html=await bounded(r,1500000);if(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*(?:noindex|noarchive|nosnippet)/i.test(html))return null;return html;
 }catch{return null;}}

export async function fetchApprovedMerchantSource(raw:string):Promise<string|null>{const url=merchantSource(raw);if(!url)return null;const init={redirect:'manual' as const,signal:AbortSignal.timeout(6000),headers:{'User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)','Accept':'text/html,text/plain'}};
 try{const robots=await fetch(url.origin+'/robots.txt',init),body=robots.status===404?null:robots.ok?await bounded(robots,128000):'User-agent: *\nDisallow: /';if(body!==null&&!robotsAllowed(body,url.pathname+url.search))return null;
 const response=await fetch(url,init);if(!response.ok||!response.headers.get('content-type')?.includes('text/html')||/noindex|noarchive|nosnippet/i.test(response.headers.get('x-robots-tag')||''))return null;
 const html=await bounded(response,1500000);if(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*(?:noindex|noarchive|nosnippet)/i.test(html))return null;return html;
 }catch{return null;}}
