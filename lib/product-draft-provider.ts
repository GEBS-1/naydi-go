import {env} from '@/lib/server-env';
import {categories} from './model';
import {routerCall} from './router-gateway';
import {rulesFor} from './category-card-rules';
import {applySellerAnswers} from './category-card-rules';
import {buildDraftSession,productDraftSchema,type ProductDraft,type ProductDraftSession} from './product-draft-contract';
export {productDraftSchema,type ProductDraft,type ProductDraftSession} from './product-draft-contract';

const draftSystem=`Ты помощник продавца офлайн-магазина в России. Готовишь карточку в духе маркетплейса, но с сильным блоком «где применяется» для локального поиска.

Верни СТРОГО один JSON (без markdown):
{
  "name": "...",
  "category": "<ровно одно из: ${categories.join(' | ')}>",
  "brand": "",
  "model": "",
  "description": "1–3 предложения",
  "features": "Ключ: значение\\n...",
  "attributes": [{"name":"...","value":"..."}],
  "applications": "где и для чего применяют — конкретно, для поиска покупателем",
  "keywords": "слова через пробел",
  "barcode": "",
  "weightKg": null,
  "dimensions": {"lengthCm":null,"widthCm":null,"heightCm":null},
  "suggestions": {"use":"предложение применения если не уверен","size":"..."}
}

Правила доверия:
- Не выдумывай бренд, модель, штрихкод, габариты, совместимость — если не видно/не сказано, оставь "" или null и дай hints в suggestions.
- applications обязателен по смыслу: типовые сценарии применения товара (не реклама).
- Не возвращай цену, остаток, SKU, URL, фото.`;

export interface ProductDraftInput{
  description?:string;
  image?:string;
  shopCategory?:string;
  shopName?:string;
  /** Previous draft JSON for refine pass */
  previous?:Partial<ProductDraft>;
  /** Seller answers to clarifying questions */
  answers?:Record<string,string>;
}

export interface ProductDraftProvider{
  fromImage(image:string):Promise<ProductDraftSession>;
  fromDescription(input:ProductDraftInput):Promise<ProductDraftSession>;
}

function extractJson(raw:string):unknown{
  const text=(raw||'').trim();
  if(!text)throw Error('AI не вернул ответ.');
  try{return JSON.parse(text);}catch{/* continue */}
  const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fenced){try{return JSON.parse(fenced[1].trim());}catch{/* continue */}}
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start>=0&&end>start){try{return JSON.parse(text.slice(start,end+1));}catch{/* continue */}}
  throw Error('AI не вернул структурированный черновик.');
}

export class RouterAIProductDraftProvider implements ProductDraftProvider{
  async fromImage(image:string){
    return this.fromDescription({image});
  }
  async fromDescription(input:ProductDraftInput):Promise<ProductDraftSession>{
    const text=(input.description||'').trim();
    const image=input.image||'';
    if(!text&&!image&&!input.previous)throw Error('Опишите товар текстом или приложите фото.');
    const shopCategory=input.shopCategory&&categories.includes(input.shopCategory as typeof categories[number])?input.shopCategory:undefined;
    const mergedPrevious=input.previous&&input.answers
      ?{...input.previous,...applySellerAnswers(input.previous,input.previous.category||shopCategory||categories[0],input.answers)}
      :input.previous;
    const rules=rulesFor(mergedPrevious?.category||shopCategory||categories[0]);
    const context=[
      input.shopName?`Магазин: ${input.shopName}`:'',
      shopCategory?`Категория витрины: ${shopCategory}`:'',
      `Фокус категории «${rules.title}»: ${rules.focus}`,
      `Нужные поля: ${rules.fields.map(f=>f.label+(f.required?'*':'')).join(', ')}`,
    ].filter(Boolean).join('\n');

    let prompt:string;
    if(mergedPrevious&&input.answers&&Object.keys(input.answers).length){
      prompt=`Уточни карточку по ответам продавца. Не меняй то, что продавец явно указал. Допиши applications и attributes.\n${context}\n\nЧерновик:\n${JSON.stringify(mergedPrevious)}\n\nОтветы продавца:\n${JSON.stringify(input.answers)}\n\nДоп.описание:\n${text||'—'}`;
    }else if(text){
      prompt=`Создай карточку по описанию продавца.\n${context}\n\nОписание:\n${text.slice(0,3000)}`;
    }else{
      prompt=`Создай карточку по фото. Распознай тип товара. Для неизвестного — пустые поля + suggestions.\n${context}`;
    }

    const userContent=image
      ?[{type:'text',text:prompt},{type:'image_url',image_url:{url:image}}]
      :prompt;
    const model=image
      ?(env.ROUTERAI_VISION_MODEL||'qwen/qwen3-vl-8b-instruct')
      :(env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507');
    const answer=await routerCall({
      model,
      max_tokens:1600,temperature:0,response_format:{type:'json_object'},
      messages:[{role:'system',content:draftSystem},{role:'user',content:userContent}],
    });
    return buildDraftSession(extractJson(answer.choices?.[0]?.message.content||''));
  }
}

export function productDraftProvider():ProductDraftProvider{return new RouterAIProductDraftProvider();}
