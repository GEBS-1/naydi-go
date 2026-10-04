import {startYandex} from '@/lib/buyer-yandex';
export async function POST(req:Request){try{const result=await startYandex(req);return Response.json({url:result.url},{headers:{'Set-Cookie':result.cookie,'Cache-Control':'no-store'}});}catch{return Response.json({error:'Не удалось начать вход через Яндекс. Попробуйте позднее.'},{status:400});}}
