import {z} from 'zod';
import {routerCall} from './router-gateway';
import {cacheRead,cacheWrite} from './search-storage';
import {cacheHit} from './search-usage';
import {resolveSearch,type SearchContext} from './search-context';
import {purchaseFocus} from './purchase-query';

const decision=z.object({query:z.string().trim().min(2).max(500),sort:z.enum(['relevance','price','price-distance']),newOnly:z.boolean(),journey:z.boolean(),question:z.string().max(180).nullable()}).strict();
// Only search conditions. The model cannot supply offers, prices, addresses or points.
export async function dialogContext(message:string,previous?:SearchContext){
 if(!previous&&/этот вариант|покажи похож|а что есть по дороге|ищи ближе/iu.test(message))return {context:{query:''} as SearchContext,question:'Что именно вы хотите найти? Напишите товар или услугу.'};
 const basic=resolveSearch(message,previous);
 const focused=purchaseFocus(message);
 if(focused)return {context:{...basic,query:focused.query},question:focused.question};
 const conversational=/этот вариант|покажи похож|ищи ближе|к дому|а что есть|мне нужен|посоветуй|подбери|недорогой подарок|что купить|чтобы|для того чтобы/iu.test(message);
 if(!conversational)return {context:basic,question:null};
 const key='dialog:v1:'+JSON.stringify([message.trim().toLowerCase(),previous||null]);
 try{
  let parsed=await cacheRead<z.infer<typeof decision>>(key);
  if(parsed){parsed=decision.parse(parsed);cacheHit();}
  else{
   const response=await routerCall({model:'qwen/qwen3-30b-a3b-instruct-2507',max_tokens:500,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:'Преобразуй сообщение покупателя в условия товарного поиска. Ответ строго JSON: query (конкретный товар или услуга на русском, без вежливых оборотов и без информационных формулировок), sort (relevance|price|price-distance), newOnly (boolean), journey (boolean), question (один действительно необходимый вопрос или null). Определи конечную покупательскую цель: просьба подобрать инструмент для выполнения задачи означает поиск инструмента, а не статей о задаче. Сохраняй явно названную марку, модель и год автомобиля. Если совместимость зависит от двигателя, задай вопрос, но оставь пригодный предварительный запрос. При уточнении сохрани предмет прошлого запроса. Дешевле означает сортировку, не выдумывай бюджет. Ближе к дому: спроси адрес, не придумывай его. По дороге: спроси куда едут. Подарок ребёнку без возраста: спроси возраст. Не придумывай товары, цены, координаты или сведения о пользователе.'},{role:'user',content:JSON.stringify({message,previous:previous||null})}]});
   parsed=decision.parse(JSON.parse(response.choices?.[0]?.message.content||''));
   await cacheWrite(key,parsed,1800000);
  }
  const context:SearchContext={...(previous||{}),...basic,query:parsed.query,sort:parsed.sort,newOnly:parsed.newOnly||previous?.newOnly};
  // Numeric constraints only come from deterministic parsing of user input.
  if(parsed.journey&&!/по дороге|по пути/iu.test(context.query))context.query+=' по дороге';
  return {context,question:parsed.question};
 }catch{return {context:basic,question:null};} // LLM failures never stop ordinary search.
}
