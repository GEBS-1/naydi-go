import {bucket,db} from '@/db';
import {actor,previewShop,privateHeaders} from '@/lib/onboarding';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});
 const a=await actor(),path=`/api/photos/${id}`;
 const owned=a.user?await db().prepare('SELECT id FROM uploads WHERE id=? AND owner=?').bind(id,a.user.userId).first():null;
 const publicRef=await db().prepare("SELECT s.id FROM shops s WHERE s.visibility='public' AND COALESCE(json_extract(s.data,'$.demo'),0)=0 AND (EXISTS (SELECT 1 FROM json_each(s.data,'$.photos') WHERE value=?) OR EXISTS (SELECT 1 FROM products p,json_each(p.data,'$.photos') photo WHERE p.store_id=s.id AND p.published=1 AND COALESCE(json_extract(p.data,'$.demo'),0)=0 AND photo.value=?)) LIMIT 1").bind(path,path).first();
 const preview=new URL(req.url).searchParams.get('preview'),draft=preview?await previewShop(preview):null;
 const privateRef=await db().prepare("SELECT s.id FROM shops s WHERE (s.owner=? OR s.id=?) AND (EXISTS (SELECT 1 FROM json_each(s.data,'$.photos') WHERE value=?) OR EXISTS (SELECT 1 FROM products p,json_each(p.data,'$.photos') photo WHERE p.store_id=s.id AND photo.value=?)) LIMIT 1").bind(a.user?.userId||'',draft?.id||'',path,path).first();
 if(!a.admin&&!owned&&!publicRef&&!privateRef)return new Response('Not found',{status:404,headers:privateHeaders});
 const object=await bucket().get(id);if(!object)return new Response('Not found',{status:404,headers:privateHeaders});
 return new Response(object.body,{headers:{...privateHeaders,'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff'}});
}
