import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {BlockList} from 'node:net';
import {allowedSource} from './source-fetch';
const denied=new BlockList();
for(const [ip,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['192.0.2.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)denied.addSubnet(ip,prefix,'ipv4');
type Photo={bytes:Buffer;type:string;at:number};
const images=new Map<string,Photo>(),pending=new Map<string,Promise<Photo|null>>();let total=0;
let active=0;const waiters:(()=>void)[]=[];
async function queuedDownload(raw:string){
 if(active>=4)await new Promise<void>(resolve=>waiters.push(resolve));
 else active++;
 try{return await download(raw);}finally{const next=waiters.shift();if(next)next();else active--;}
}
export function rasterType(b:Buffer){
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'image/webp';
 if(/^GIF8[79]a$/.test(b.subarray(0,6).toString()))return 'image/gif';
 return null;
}
async function download(raw:string):Promise<Photo|null>{
 const url=allowedSource(raw);if(!url)return null;
 const addresses=await lookup(url.hostname,{family:4,all:true});
 if(!addresses.length||addresses.some(a=>denied.check(a.address,'ipv4')))return null;
 const address=addresses[0].address;
 return new Promise(resolve=>{
  let done=false;const finish=(value:Photo|null)=>{if(!done){done=true;clearTimeout(timer);resolve(value);}};
  const req=request(url,{method:'GET',family:4,headers:{'User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)','Accept':'image/jpeg,image/png,image/webp,image/gif'},lookup:(_hostname,_options,callback)=>callback(null,address,4)},res=>{
   if(res.statusCode!==200||Number(res.headers['content-length']||0)>4*1024*1024){res.destroy();finish(null);return;}
   let size=0;const chunks:Buffer[]=[];
   res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>4*1024*1024){res.destroy();finish(null);}else chunks.push(chunk);});
   res.on('error',()=>finish(null));res.on('end',()=>{const bytes=Buffer.concat(chunks),type=rasterType(bytes);finish(type?{bytes,type,at:Date.now()}:null);});
  });
  const timer=setTimeout(()=>{req.destroy();finish(null);},8000);req.on('error',()=>finish(null));req.end();
 });
}
export async function searchImage(raw:string){
 const cached=images.get(raw);if(cached&&Date.now()-cached.at<3600000)return cached;
 if(pending.has(raw))return pending.get(raw)!;if(pending.size>=32)return null;
 const task=queuedDownload(raw).catch(()=>null);pending.set(raw,task);
 try{const photo=await task;if(photo){if(cached){images.delete(raw);total-=cached.bytes.length;}while(total+photo.bytes.length>32*1024*1024&&images.size){const key=images.keys().next().value!;total-=images.get(key)!.bytes.length;images.delete(key);}images.set(raw,photo);total+=photo.bytes.length;}return photo;}finally{pending.delete(raw);}
}
