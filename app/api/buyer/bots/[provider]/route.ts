import {buyerBotWebhook} from '@/lib/buyer-bots';
export async function POST(req:Request,{params}:{params:Promise<{provider:string}>}){const {provider}=await params;if(provider!=='telegram'&&provider!=='max')return new Response('Not found',{status:404});try{return await buyerBotWebhook(req,provider);}catch{return new Response('Invalid event',{status:400});}}
