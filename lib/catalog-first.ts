import type {SearchHit} from './city-search';

export type SourceResult={hits:SearchHit[];status:string;error?:string};
export type ParallelSourceResult=SourceResult&{catalogStatus:string};

async function safelyRead(source:()=>Promise<SourceResult>):Promise<SourceResult>{
 try{return await source();}catch(error){return {hits:[],status:'unavailable',error:error instanceof Error?error.message:undefined};}
}

/** Fetch the reviewed seller catalog and external web results together. */
export async function catalogAndWebParallel(
 catalog:()=>Promise<SourceResult>,
 web:(onPartial?:(result:SourceResult)=>void|Promise<void>)=>Promise<SourceResult>,
 browse:boolean,
 onPartial?:(result:ParallelSourceResult)=>void|Promise<void>,
):Promise<ParallelSourceResult>{
 if(browse){
  const seller=await safelyRead(catalog);
  const result={...seller,catalogStatus:seller.status};
  await onPartial?.(result);
  return result;
 }
 let seller:SourceResult|undefined,external:SourceResult|undefined;
 const publish=async()=>{
  await onPartial?.({hits:[...(seller?.hits||[]),...(external?.hits||[])],status:external?.status||'pending',catalogStatus:seller?.status||'pending',...(external?.error?{error:external.error}:{})});
 };
 const [sellerResult,externalResult]=await Promise.all([
  safelyRead(catalog).then(async result=>{seller=result;await publish();return result;}),
  safelyRead(()=>web(async result=>{external=result;await publish();})).then(async result=>{external=result;await publish();return result;}),
 ]);
 const [finalSeller,finalExternal]=[sellerResult,externalResult];
 return {hits:[...finalSeller.hits,...finalExternal.hits],status:finalExternal.status,catalogStatus:finalSeller.status,...(finalExternal.error?{error:finalExternal.error}:{})};
}
