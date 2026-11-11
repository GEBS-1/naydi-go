import {categories,type Product} from './model';

export type CategoryId=(typeof categories)[number];

export type CardFieldRule={
  key:string;
  label:string;
  /** Ask seller if missing after first AI pass */
  ask:string;
  /** Attribute name when stored in attributes[] */
  attribute?:string;
  /** Built-in product field */
  field?:'brand'|'model'|'weightKg'|'dimensions'|'barcode'|'applications'|'quantity';
  required:boolean;
};

/** Marketplace-style rules per buyer category: what the card needs for search & trust. */
export const categoryCardRules:Record<CategoryId,{title:string;focus:string;fields:CardFieldRule[]}>={
  'Дом и ремонт':{
    title:'Дом и ремонт',
    focus:'материал, размер/подключение, для каких работ',
    fields:[
      {key:'brand',label:'Бренд',ask:'Какой бренд? Если no-name — напишите «без бренда».',field:'brand',required:false},
      {key:'size',label:'Размер / диаметр',ask:'Какой размер, диаметр или посадочное место?',attribute:'Размер',required:true},
      {key:'material',label:'Материал',ask:'Из какого материала (металл, пластик, дерево…)?',attribute:'Материал',required:false},
      {key:'use',label:'Применение',ask:'Где применяется: для каких работ или узлов?',field:'applications',required:true},
      {key:'dims',label:'Габариты',ask:'Есть ли габариты в см (Д×Ш×В)?',field:'dimensions',required:false},
    ],
  },
  'Автотовары':{
    title:'Автотовары',
    focus:'совместимость с авто, объём/вязкость, применение',
    fields:[
      {key:'brand',label:'Бренд',ask:'Бренд производителя?',field:'brand',required:true},
      {key:'compat',label:'Совместимость',ask:'Для каких авто / двигателей / узлов подходит?',attribute:'Совместимость',required:true},
      {key:'spec',label:'Параметр',ask:'Вязкость, ёмкость, тип (масло, фильтр, АКБ…)?',attribute:'Параметр',required:true},
      {key:'use',label:'Применение',ask:'Где ставится / для чего в машине?',field:'applications',required:true},
    ],
  },
  'Спорт и хобби':{
    title:'Спорт и хобби',
    focus:'для кого, размер, вид спорта',
    fields:[
      {key:'sport',label:'Вид спорта',ask:'Какой вид спорта или хобби?',attribute:'Вид спорта',required:true},
      {key:'size',label:'Размер',ask:'Размер (одежда, рама, длина…)?',attribute:'Размер',required:false},
      {key:'level',label:'Уровень',ask:'Для начинающих, любителей или профи?',attribute:'Уровень',required:false},
      {key:'use',label:'Применение',ask:'Где и как используют (зал, улица, сезон)?',field:'applications',required:true},
    ],
  },
  'Электроника':{
    title:'Электроника',
    focus:'модель, интерфейсы, для каких устройств',
    fields:[
      {key:'brand',label:'Бренд',ask:'Бренд и модель?',field:'brand',required:true},
      {key:'model',label:'Модель',ask:'Точная модель или артикул с коробки?',field:'model',required:false},
      {key:'compat',label:'Совместимость',ask:'С какими устройствами работает?',attribute:'Совместимость',required:true},
      {key:'ports',label:'Интерфейс',ask:'Разъёмы / беспроводной стандарт (USB-C, BT…)?',attribute:'Интерфейс',required:false},
      {key:'use',label:'Применение',ask:'Для каких задач покупают (игры, офис, дом)?',field:'applications',required:true},
    ],
  },
  'Сад и дача':{
    title:'Сад и дача',
    focus:'сезон, культура/задача, объём',
    fields:[
      {key:'season',label:'Сезон',ask:'Для какого сезона или круглый год?',attribute:'Сезон',required:false},
      {key:'crop',label:'Культура / задача',ask:'Для каких растений или работ на участке?',attribute:'Назначение',required:true},
      {key:'volume',label:'Объём / фасовка',ask:'Фасовка (л, кг, шт.)?',attribute:'Фасовка',required:false},
      {key:'use',label:'Применение',ask:'Как применяют: полив, посадка, защита…?',field:'applications',required:true},
    ],
  },
  'Зоотовары':{
    title:'Зоотовары',
    focus:'вид животного, возраст, состав/размер',
    fields:[
      {key:'animal',label:'Животное',ask:'Для какого животного (кошка, собака…)?',attribute:'Животное',required:true},
      {key:'age',label:'Возраст',ask:'Возраст или размер питомца?',attribute:'Возраст',required:false},
      {key:'weight',label:'Фасовка',ask:'Вес упаковки (кг)?',field:'weightKg',required:false},
      {key:'use',label:'Применение',ask:'Корм, лакомство, гигиена, амуниция — как используют?',field:'applications',required:true},
    ],
  },
};

export function rulesFor(category:string){
  return categoryCardRules[(categories.includes(category as CategoryId)?category:'Дом и ремонт') as CategoryId];
}

export type DraftQuestion={id:string;label:string;ask:string;key:string;suggested?:string};

/** Compare draft/product against category rules → missing questions. */
export function missingCardQuestions(input:{
  category:string;
  brand?:string;
  model?:string;
  attributes?:{name:string;value:string}[];
  applications?:string;
  weightKg?:number|null;
  dimensions?:{lengthCm?:number|null;widthCm?:number|null;heightCm?:number|null};
  suggestions?:Record<string,string>;
}):DraftQuestion[]{
  const rules=rulesFor(input.category);
  const attrs=new Map((input.attributes||[]).map(a=>[a.name.toLowerCase(),a.value]));
  const questions:DraftQuestion[]=[];
  for(const field of rules.fields){
    let filled=false;
    if(field.field==='brand')filled=!!(input.brand||'').trim();
    else if(field.field==='model')filled=!!(input.model||'').trim();
    else if(field.field==='applications')filled=!!(input.applications||'').trim();
    else if(field.field==='weightKg')filled=input.weightKg!=null&&input.weightKg>0;
    else if(field.field==='dimensions'){
      const d=input.dimensions;filled=!!(d&&(d.lengthCm||d.widthCm||d.heightCm));
    }else if(field.attribute)filled=!!attrs.get(field.attribute.toLowerCase());
    if(!filled&&(field.required||!questions.length)){
      questions.push({
        id:field.key,label:field.label,ask:field.ask,key:field.key,
        suggested:input.suggestions?.[field.key],
      });
    }
    if(questions.length>=4)break;
  }
  return questions;
}

/** Merge seller answers into attributes / applications for the next AI pass. */
export function applySellerAnswers(
  base:{attributes?:{name:string;value:string}[];applications?:string;brand?:string;model?:string;features?:string},
  category:string,
  answers:Record<string,string>,
){
  const rules=rulesFor(category);
  const attributes=[...(base.attributes||[])];
  let applications=base.applications||'';
  let brand=base.brand||'';
  let model=base.model||'';
  const extraFeatures:string[]=[];
  for(const field of rules.fields){
    const value=(answers[field.key]||'').trim();
    if(!value)continue;
    if(field.field==='applications')applications=value;
    else if(field.field==='brand')brand=value;
    else if(field.field==='model')model=value;
    else if(field.attribute){
      const i=attributes.findIndex(a=>a.name.toLowerCase()===field.attribute!.toLowerCase());
      if(i>=0)attributes[i]={name:field.attribute,value};else attributes.push({name:field.attribute,value});
      extraFeatures.push(`${field.attribute}: ${value}`);
    }else extraFeatures.push(`${field.label}: ${value}`);
  }
  const features=[base.features||'',...extraFeatures].filter(Boolean).join('\n');
  return {attributes:attributes.slice(0,12),applications,brand,model,features};
}

export function searchTextFromProduct(p:Pick<Product,'name'|'brand'|'model'|'description'|'features'|'keywords'|'category'> & {applications?:string;attributes?:{name:string;value:string}[]}){
  return [p.name,p.brand,p.model,p.category,p.description,p.features,p.keywords,p.applications,(p.attributes||[]).map(a=>`${a.name} ${a.value}`).join(' ')].filter(Boolean).join(' ');
}
