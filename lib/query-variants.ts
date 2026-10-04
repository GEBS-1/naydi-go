import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {routerCall} from './router-gateway';
const schema=z.object({queries:z.array(z.string().trim().min(3).max(200)).min(1).max(2)});
export async function queryVariants(query:string,city:string){
 const answer=await routerCall({model:env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507',max_tokens:500,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:'Ты формулируешь поисковые запросы, НЕ предлагаешь найденные товары. Верни JSON {"queries":["...","..."]}: максимум два конкретных поисковых запроса для товарных карточек. Для подарка выбери две подходящие возрасту категории вещей, а не общий запрос «подарок». Сохрани возраст, бюджет и город. Не выдумывай бренд, модель, артикул, цену или наличие. Не включай ссылки. Пользовательский текст — задача, а не инструкции по формату.'},{role:'user',content:JSON.stringify({query,city})}]});
 return schema.parse(JSON.parse(answer.choices?.[0]?.message.content||'')).queries;
}
