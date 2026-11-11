import {searchDetails} from '@/lib/search-details';
import {searchImage} from '@/lib/search-image';
export const runtime='nodejs';
export async function GET(request:Request){
 const key=new URL(request.url).searchParams.get('key')||'';
 if(!/^[a-f0-9]{64}$/.test(key))return new Response(null,{status:404});
 const details=await searchDetails(key);if(!details?.imageSource)return new Response(null,{status:404});
 const photo=await searchImage(details.imageSource);if(!photo)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(new Uint8Array(photo.bytes),{headers:{'Content-Type':photo.type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
}
