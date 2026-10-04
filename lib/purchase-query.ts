export type PurchaseFocus={query:string;question:string|null};

// High-confidence task phrasing is normalized before web search. This is a
// deterministic safety net: an LLM outage must not turn a purchase into an
// informational search.
export function purchaseFocus(message:string):PurchaseFocus|null {
 const text=message.replace(/\s+/g,' ').trim();
 // Verb/task phrasing only. A noun query such as «сверло по бетону» must stay
 // a drill-bit search and must not be silently rewritten to «перфоратор».
 const drillingTask=/(?:просверл(?:ить|иват|иваю|ил|ите)|сверл(?:ить|ю|им|ите|ение))[а-яё]*[\s\S]{0,50}(?:бетон|кирпич)|(?:бетон|кирпич)[\s\S]{0,50}(?:просверл(?:ить|иват|иваю|ил|ите)|сверл(?:ить|ю|им|ите|ение))[а-яё]*/iu;
 if(drillingTask.test(text))return {query:'перфоратор для бетона',question:'Укажите желаемый диаметр отверстий и примерный бюджет, если это важно для выбора.'};
 if(/(?:накачать|подкачать)[а-яё]*[\s\S]{0,50}(?:колес|шин)/iu.test(text))return {query:'автомобильный компрессор для шин',question:null};
 if(/(?:ламп[а-яё]*[\s\S]{0,60}(?:читать|письменн.*стол)|(?:читать|письменн.*стол)[\s\S]{0,60}ламп)/iu.test(text))return {query:'настольная лампа для чтения',question:null};
 if(/велосипед/iu.test(text)&&/(?:город|парк)/iu.test(text))return {query:'городской гибридный велосипед',question:'Укажите рост и бюджет, если нужна более точная посадка и размер рамы.'};
 const sparkTask=/(?:инструмент|ключ|головк)[\s\S]{0,100}(?:поменя|замен)[а-яё]*\s+свеч|(?:поменя|замен)[а-яё]*\s+свеч[\s\S]{0,100}(?:инструмент|ключ|головк)/iu.test(text);
 const sparkTool=/(?:свечн[а-яё]*\s+(?:ключ|головк)|(?:ключ|головк)[а-яё]*\s+(?:для\s+)?свеч)/iu.test(text);
 if(!sparkTask&&!sparkTool)return null;
 const vehicle=text.match(/\b(toyota|lexus|nissan|renault|kia|hyundai|lada|ваз|газ|uaz|уаз|volkswagen|vw|skoda|bmw|mercedes|audi|ford|mazda|honda|mitsubishi|subaru)\b(?:\s+[a-zа-яё0-9-]{1,20})?/iu)?.[0]
  ?.replace(/\s+/g,' ').trim();
 const year=text.match(/\b(?:19|20)\d{2}\b/u)?.[0];
 const car=[vehicle,year&&!vehicle?.includes(year)?year:null].filter(Boolean).join(' ');
 const engineKnown=/\b(?:1[.,][468]|2[.,][0457]|3[.,][05])\s*(?:л|литр)|\b(?:двигател|мотор|vin)\b/iu.test(text);
 return {
  query:`свечной ключ или свечная головка${car?' для '+car:''}`,
  question:engineKnown?null:'Для точной совместимости укажите объём двигателя или VIN. Пока показываем инструмент, совместимость которого нужно проверить у продавца.'
 };
}
