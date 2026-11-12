import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['lib/listing-guide.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {explicitListingTitle,listingFacts,listingMissing,listingPrice}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
assert.deepEqual(explicitListingTitle('Хочу разместить набор цветных карандашей 12 цветов, новый. Цена 299 рублей.'),{name:'набор цветных карандашей 12 цветов',description:'набор цветных карандашей 12 цветов'});
assert.deepEqual(explicitListingTitle('Помоги с карточкой'),{});
for(const [message,expected] of [
 ['Продаю велосипед б/у за 5500 рублей',{condition:'used',price:5500,priceMode:'fixed'}],
 ['Новый велосипед за 5 тысяч',{condition:'new',price:5000,priceMode:'fixed'}],
 ['Не новый, как новый',{condition:'used'}],
 ['Не пользовался, отдам бесплатно',{condition:'new',price:0,priceMode:'free'}],
 ['Помоги описать велосипед',{}],
 ['Не отдам бесплатно',{}],
 ['Велосипед за 100 долларов',{}],
 ['От 5000 рублей',{}],
 ['Поставь цену 1 500',{price:1500,priceMode:'fixed'}],
 ['Сделай цену договорной',{priceMode:'negotiable'}],
])assert.deepEqual(listingFacts(message),expected,message);
const draft={sellerName:'Анна',selectedCity:{label:'Казань',lat:55.8,lng:49.1},name:'Детский велосипед',description:'Мой велосипед в хорошем состоянии',condition:'used',photos:['photo'],price:'5500',priceMode:'fixed',phone:'+7 900 000-00-00',city:'Казань',street:'Тестовая, 12',point:{lat:55.8,lng:49.1}};
assert.equal(listingMissing(draft,0).length,0);assert.equal(listingMissing({...draft,condition:''},0).length,1);assert.equal(listingMissing({...draft,price:''},0).length,1);
assert.equal(listingMissing({...draft,price:'',priceMode:'negotiable'},0).length,0);assert.equal(listingPrice({...draft,priceMode:'negotiable'}),null);assert.equal(listingPrice({...draft,priceMode:'free'}),0);
assert.equal(listingMissing({...draft,point:null},1).length,1);
assert.equal(listingMissing({...draft,sellerType:'business',companyName:''},1).length,1);
assert.equal(listingMissing({...draft,sellerType:'business',companyName:'Магазин рядом'},2).length,0);
console.log('PASS listing guide: required fields, no guessed condition/price, explicit commercial facts, nullable negotiation and map point');
