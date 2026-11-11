import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function load(path){const b=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));}
const {resolveExactAddress}=await load('lib/local-business.ts'),{extractOffers,indexedOfferHit}=await load('lib/offer-extraction.ts'),{relevantOffers}=await load('lib/offer-relevance.ts'),{parseIntent,routeHit,hasConfirmedLocation}=await load('lib/city-search.ts');
const building={lat:55.7907633,lng:49.1566121,label:'Казань, улица Зинина 5, Татарстан, Россия',city:'Казань',extent:[49.156248,55.7909392,49.156982,55.7905817]},node={lat:55.7908025,lng:49.1563702,label:building.label,city:'Казань'};
assert.deepEqual(resolveExactAddress([building,node],'Казань','ул. Зинина, 5'),building);
assert.deepEqual(resolveExactAddress([node,node],'Казань','ул. Зинина, 5'),node);
assert.equal(resolveExactAddress([building,{...node,lat:55.81}],'Казань','ул. Зинина, 5'),null);
assert.equal(resolveExactAddress([building,node],'Казань','ул. Зинина, 55'),null);
assert.equal(resolveExactAddress([building,node],'Самара','ул. Зинина, 5'),null);
const source='https://shop.example/man/winter-coats',ld=x=>'<script type="application/ld+json">'+JSON.stringify(x)+'</script>';
const product=(name,url)=>({'@type':'Product',name,url,image:'/images/coat.jpg',offers:{'@type':'Offer',price:'14900',priceCurrency:'RUB',availability:'https://schema.org/InStock'}});
const html='<h1>Зимние мужские куртки и пуховики</h1>'+ld([product('Мужской удлинённый пуховик','/man/winter-coats/model.html'),product('Женская куртка','/man/winter-coats/woman.html'),product('Мужская летняя куртка','/man/winter-coats/summer.html'),product('Рекомендация из другого раздела','/woman/summer/model.html')]);
const offers=extractOffers(html,source,'Казань');assert.equal(offers[0].category,'Зимние мужские куртки и пуховики');assert.equal(offers[0].price,14900);assert.equal(offers[0].image,'https://shop.example/images/coat.jpg');assert.equal(offers[3].category,'');assert.deepEqual(relevantOffers(offers,'зимние мужские куртки','Казань').map(o=>o.title),['Мужской удлинённый пуховик']);
assert.equal(indexedOfferHit('https://www.avito.ru/kazan/odezhda/verhnyaya/100-ASgBAgICBETeAtgL','Мужские зимние куртки и пуховики 100% в Казани','', 'Казань').kind,'page');
assert.equal(indexedOfferHit('https://www.avito.ru/kazan/odezhda/muzhskaya_zimnyaya_kurtka_8299818802','Мужская зимняя куртка','14900 рублей', 'Казань').kind,'product');
assert.ok(parseIntent('зимние мужские куртки','Казань').selectors.includes('["shop"="clothes"]'));
const hit={...offers[0],city:'Казань',address:'ул. Зинина, 5',point:null};assert.equal(hasConfirmedLocation(hit),false);assert.equal(routeHit(hit),null);
const verified={...hit,point:{lat:building.lat,lng:building.lng},locationEvidence:'confirmed-point'};assert.equal(hasConfirmedLocation(verified),true);assert.match(routeHit(verified),/55.7907633/);assert.equal(routeHit({...verified,point:{lat:Infinity,lng:49.1}}),null);
console.log('PASS reported coat query: building/address-node duplicate resolved; genuinely ambiguous houses rejected; catalog category retains real product/photo/price; wrong gender/season rejected; Avito listing stays a page; map and route use the same verified points');

const facts=extractOffers(ld({...product('Куртка','/man/winter-coats/model.html'),model:'M-10',brand:{name:'Марка'},color:'Бронзовый',additionalProperty:[{'@type':'PropertyValue',name:'Утеплитель',value:'Пух'}],aggregateRating:{ratingValue:'4.8',bestRating:'5',reviewCount:'23'}}),source,'Казань')[0];
assert.equal(facts.model,'M-10');assert.equal(facts.brand,'Марка');assert.equal(facts.characteristics.find(x=>x.name==='Утеплитель').value,'Пух');assert.deepEqual(facts.rating,{value:4.8,best:5,count:23});assert.equal(offers[0].rating,undefined);
console.log('PASS published model, brand, characteristics and rating are scoped to the product; absent ratings stay absent');

assert.equal(indexedOfferHit('https://www.avito.ru/kazan/odezhda/muzhskaya_zimnyaya_kurtka_8299818802','Мужская зимняя куртка','', 'Казань').kind,'product');
assert.equal(extractOffers(ld({...product('Куртка','/man/winter-coats/model.html'),description:'Ветрозащитная ткань, съёмный капюшон.'}),source,'Казань')[0].description,'Ветрозащитная ткань, съёмный капюшон.');
