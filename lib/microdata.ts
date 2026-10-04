// Read-only, bounded microdata extraction. Never evaluates scripts or HTML.
type Item=Record<string,unknown>;
const entities=(s:string)=>s.replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
export function microdata(html:string):Item[]{
 const roots:Item[]=[],stack:{tag:string;scope:Item|null;prop:string;target:Item|null;value:string}[]=[];
 const add=(item:Item,key:string,value:unknown)=>{if(!key)return;for(const prop of key.split(/\s+/)){if(item[prop]===undefined)item[prop]=value;else item[prop]=[item[prop],value].flat();}};
 const clean=html.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>/gi,'');
 let count=0;for(const m of clean.matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)){
  if(++count>100000)break;const token=m[0];
  if(!token.startsWith('<')){for(const node of stack)if(node.prop)node.value+=token;continue;}
  const tag=token.match(/^<\/?([a-z0-9]+)/i)?.[1]?.toLowerCase();if(!tag)continue;
  const close=()=>{const node=stack.pop();if(node?.prop&&node.target){const value=entities(node.value.replace(/\s+/g,' ').trim());if(value)add(node.target,node.prop,value);}};
  if(token.startsWith('</')){const index=stack.findLastIndex(n=>n.tag===tag);if(index>=0)while(stack.length>index)close();continue;}
  const attrs:Record<string,string>={};for(const a of token.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[a[1].toLowerCase()]=entities(a[2]??a[3]??a[4]??'');
  const parent=stack.at(-1)?.scope||null;let scope=parent,prop=attrs.itemprop||'',target=parent;
  if(/\bitemscope(?:\s|=|\/?>)/i.test(token)){scope={'@type':(attrs.itemtype||'').split('/').at(-1)};roots.push(scope);if(parent&&prop)add(parent,prop,scope);prop='';target=null;}
  const attrValue=attrs.content??(tag==='a'||tag==='link'?attrs.href:tag==='img'?attrs.src:undefined);
  if(prop&&target&&attrValue!==undefined){add(target,prop,attrValue);prop='';}
  stack.push({tag,scope,prop,target,value:''});if(/^(meta|link|img|input|br|hr|source|wbr|area|base|embed|param|track)$/.test(tag)||token.endsWith('/>'))close();
 }
 return roots;
}
