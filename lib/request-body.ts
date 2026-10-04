/** Bound bytes while streaming, including clients that omit Content-Length. */
export async function limitedBody(req:Request,limit:number):Promise<Uint8Array>{
 if(Number(req.headers.get('content-length')||0)>limit)throw Error('Превышен допустимый размер запроса');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Превышен допустимый размер запроса');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
