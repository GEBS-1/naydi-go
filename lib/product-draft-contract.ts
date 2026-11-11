import {z} from 'zod';
import {categories} from './model';
import {missingCardQuestions,type DraftQuestion} from './category-card-rules';

export const productAttributeSchema=z.object({
  name:z.string().trim().min(1).max(80),
  value:z.string().trim().min(1).max(200),
}).strict();

export const productDraftSchema=z.object({
  name:z.string().trim().min(2).max(200),
  category:z.enum(categories),
  brand:z.string().trim().max(200),
  model:z.string().trim().max(200),
  features:z.string().trim().max(4000),
  description:z.string().trim().max(4000),
  keywords:z.string().trim().max(1000),
  applications:z.string().trim().max(2000).default(''),
  attributes:z.array(productAttributeSchema).max(12).default([]),
  barcode:z.string().trim().max(32).optional().or(z.literal('')),
  weightKg:z.number().min(0).max(10000).nullable().optional(),
  dimensions:z.object({
    lengthCm:z.number().min(0).max(10000).nullable().optional(),
    widthCm:z.number().min(0).max(10000).nullable().optional(),
    heightCm:z.number().min(0).max(10000).nullable().optional(),
  }).optional(),
}).strict();

export type ProductDraft=z.infer<typeof productDraftSchema>;
export type ProductDraftSession={draft:ProductDraft;questions:DraftQuestion[];verified:string[];needsSeller:string[]};

const categoryHints:[RegExp,(typeof categories)[number]][]=[
  [/сантех|смесит|унитаз|раковин|ванн|креп[её]ж|инструмент|дрел|перфорат|ламп|розетк|краск|плитк|инсталл/i,'Дом и ремонт'],
  [/автотовар|автомасл|моторн\w*\s*масл|шин[аы]|аккумулятор|запчаст|(^|[^а-яё])авто([^а-яё]|$)/i,'Автотовары'],
  [/зоо|корм\w*|кошк|собак|ветеринар|веттовар|ветклиник/i,'Зоотовары'],
  [/сад\b|дач[аеи]|семен|растен|грунт|удобрен/i,'Сад и дача'],
  [/спорт|велосипед|гантел|лыж|фитнес/i,'Спорт и хобби'],
  [/наушник|телефон|ноутбук|электрон|смарт|планшет|кабель|зарядк/i,'Электроника'],
];

function asString(value:unknown,max=4000){return String(value??'').trim().slice(0,max);}
function asNumber(value:unknown){if(value===null||value===undefined||value==='')return null;const n=typeof value==='number'?value:Number(String(value).replace(',','.'));return Number.isFinite(n)?n:null;}

function mapCategory(raw:unknown,haystack:string):(typeof categories)[number]{
  const text=asString(raw,200);
  const exact=categories.find(c=>c.toLowerCase()===text.toLowerCase());
  if(exact)return exact;
  for(const [re,cat] of categoryHints)if(re.test(`${text} ${haystack}`))return cat;
  return categories[0];
}

function mapAttributes(raw:unknown,features:string){
  const out:{name:string;value:string}[]=[];
  if(Array.isArray(raw)){
    for(const row of raw){
      if(!row||typeof row!=='object')continue;
      const name=asString((row as {name?:unknown;key?:unknown}).name??(row as {key?:unknown}).key,80);
      const value=asString((row as {value?:unknown}).value,200);
      if(name&&value)out.push({name,value});
      if(out.length>=12)break;
    }
  }
  if(out.length)return out;
  for(const line of features.split(/\n+/)){
    const i=line.indexOf(':');
    if(i<1)continue;
    const name=line.slice(0,i).trim().slice(0,80),value=line.slice(i+1).trim().slice(0,200);
    if(name&&value)out.push({name,value});
    if(out.length>=12)break;
  }
  return out;
}

function mapSuggestions(raw:unknown){
  if(!raw||typeof raw!=='object')return {} as Record<string,string>;
  const out:Record<string,string>={};
  for(const [k,v] of Object.entries(raw as Record<string,unknown>)){
    const s=asString(v,200);if(s)out[k]=s;
  }
  return out;
}

/** Tolerant map from model JSON → marketplace card fields. */
export function coerceProductDraft(raw:unknown):ProductDraft{
  const data=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
  const name=asString(data.name??data.title,200);
  if(name.length<2)throw Error('Модель не смогла определить название товара. Добавьте описание вручную.');
  const brand=asString(data.brand,200);
  const model=asString(data.model,200);
  const description=asString(data.description??data.about,4000);
  const features=asString(data.features??data.specs??data.characteristics,4000);
  const keywords=asString(data.keywords??data.tags,1000);
  const applications=asString(data.applications??data.usage??data.useCases,2000);
  const dimsRaw=data.dimensions&&typeof data.dimensions==='object'?data.dimensions as Record<string,unknown>:undefined;
  const draft={
    name,
    category:mapCategory(data.category,`${name} ${description} ${features} ${keywords} ${applications}`),
    brand,model,description,features,keywords,applications,
    attributes:mapAttributes(data.attributes,features),
    barcode:asString(data.barcode??data.ean??data.gtin,32),
    weightKg:asNumber(data.weightKg??data.weight),
    dimensions:dimsRaw?{
      lengthCm:asNumber(dimsRaw.lengthCm??dimsRaw.length),
      widthCm:asNumber(dimsRaw.widthCm??dimsRaw.width),
      heightCm:asNumber(dimsRaw.heightCm??dimsRaw.height),
    }:undefined,
  };
  return productDraftSchema.parse(draft);
}

export function buildDraftSession(raw:unknown):ProductDraftSession{
  const data=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
  const draft=coerceProductDraft(raw);
  const suggestions=mapSuggestions(data.suggestions);
  const questions=missingCardQuestions({...draft,suggestions});
  const verified=draft.attributes.map(a=>a.name).concat(
    draft.brand?'Бренд':'',
    draft.applications?'Применение':'',
    draft.model?'Модель':'',
  ).filter(Boolean);
  const needsSeller=questions.map(q=>q.label);
  return {draft,questions,verified,needsSeller};
}
