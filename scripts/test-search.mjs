import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {build} from 'esbuild';
// Pure search module has only type imports; transpile for Node without a TS runner.
const source=await readFile(new URL('../lib/search.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {rankSearch}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const rows=[{id:'1',name:'Компрессор автомобильный',category:'Автотовары',description:'Насос для шин',features:'12 В',keywords:'насос',brand:'Тест',model:'A',applications:'подкачка шин в дороге'},{id:'2',name:'Беспроводные наушники',category:'Электроника',description:'Гарнитура',features:'Bluetooth 5.3',keywords:'',brand:'Тест',model:'B',applications:'звонки и музыка в офисе'},{id:'3',name:'Анкер регулируемый',category:'Дом и ремонт',description:'Крепёж',features:'оцинковка',keywords:'анкер',brand:'',model:'',applications:'монтаж оконного профиля к бетону'}];
assert.equal(rankSearch(rows,'компресс')[0].id,'1');assert.equal(rankSearch(rows,'насос для машины')[0].id,'1');assert.equal(rankSearch(rows,'Bluetooth')[0].id,'2');assert.equal(rankSearch(rows,'электроника')[0].id,'2');assert.equal(rankSearch(rows,'монтаж оконного')[0].id,'3');assert.equal(rankSearch(rows,'неизвестныйтелепорт').length,0);assert.equal(rankSearch(rows,'').length,3);console.log('PASS: partial, synonyms, category, applications, empty query and no fabricated results.');

async function bundled(entry){const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',target:'node22'});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const {webSearchPayload,WEB_SEARCH_PROMPT_VERSION}=await bundled('lib/web-search-prompt.ts');
assert.equal(WEB_SEARCH_PROMPT_VERSION,'v25');
assert.deepEqual(webSearchPayload('карандаш для бровей','Казань',{lat:55.83004,lng:49.10006},'Дружба, улица Короленко'),{query:'карандаш для бровей',city:'Казань',buyerLocationApprox:{lat:55.83,lng:49.1},buyerArea:'Дружба, улица Короленко'});
assert.deepEqual(webSearchPayload('дрель','Казань'),{query:'дрель',city:'Казань'},'coordinates are included only when the user granted a location');
console.log('PASS: unified Perplexity request carries the selected query, city and permitted approximate location.');
const {hasFreshOwnedStock,offerAvailabilityAdjustment,offerFreshness,relevantOffers}=await bundled('lib/offer-relevance.ts');
assert.ok(offerAvailabilityAdjustment({kind:'product',sourceAvailability:'in_stock'})>0);
assert.ok(offerAvailabilityAdjustment({kind:'product',sourceAvailability:'out_of_stock'})<0);
assert.equal(offerAvailabilityAdjustment({kind:'store',sourceAvailability:'in_stock'}),0);
const now=Date.now(),fresh={status:'seller-confirmed',checkedAt:new Date(now-1000).toISOString()};
assert.equal(offerFreshness(fresh.checkedAt,now),'recent');assert.equal(offerFreshness(new Date(now-25*3600000).toISOString(),now),'stale');assert.equal(offerFreshness('not-a-date',now),'unknown');assert.equal(offerFreshness(new Date(now+3600000).toISOString(),now),'unknown');
assert.equal(hasFreshOwnedStock([{...fresh,sourceAvailability:'out_of_stock'}],now),false);
assert.equal(hasFreshOwnedStock([{...fresh,sourceAvailability:'in_stock'}],now),true);
const pageHit=(source,title)=>({id:source,kind:'page',title,description:'Найдена страница продавца',category:'',city:'Казань',address:null,point:null,phone:null,site:source,hours:null,source,checkedAt:'',price:null,image:null,status:'website'});
assert.deepEqual(relevantOffers([pageHit('https://maikorcos.com/','Каталог продавца — уточнить цену'),pageHit('https://seller.example/catalog/geely-tugella','Катушка зажигания Geely Tugella')],'катушка зажигания Geely Tugella','Казань').map(hit=>hit.source),['https://seller.example/catalog/geely-tugella'],'unrelated seller pages must not pollute a specific product search');
const {matchSellerLocations}=await bundled('lib/merchant-match.ts');
const {catalogLocationHits}=await bundled('lib/catalog-locations.ts');
const {autocraftQuery}=await bundled('lib/seller-catalog-rules.ts');
const sourceCatalogs=[
 {matches:/дрел|шуруповёрт/iu,url:'https://kazan.tatmetiz.ru/shop/instrument/'},
 {matches:/крепёж|дюбел/iu,url:'https://megakrepezh.ru/krepezh/'},
 {matches:/велосипед/iu,url:'https://velosky.ru/catalog/'},
];
assert.equal(catalogLocationHits('дрель makita','Казань',sourceCatalogs)[0]?.title,'Татметиз');
assert.match(catalogLocationHits('дрель makita','Казань',sourceCatalogs)[0]?.locationSource||'',/^https:\/\/www\.openstreetmap\.org\/way\//);
assert.equal(catalogLocationHits('велосипед','Самара',sourceCatalogs).length,0);
assert.equal(catalogLocationHits('дрель makita','Самара',sourceCatalogs).length,0);
assert.equal(catalogLocationHits('крепёж','Казань',sourceCatalogs)[0]?.sellerLocationGroupComplete,false);
for(const query of ['катушка зажигания Geely Tugella','масляный фильтр Geely Tugella','свечи Toyota RAV4','автозапчасти'])assert(autocraftQuery.test(query),`Autocraft catalog should be selected for: ${query}`);
assert.equal(autocraftQuery.test('статья о ремонте автомобиля'),false,'generic car articles must not trigger the Autocraft product catalog');
const catalogOffer={id:'web-offer',kind:'product',title:'Шуруповёрт',description:'',category:'Инструменты',city:'Казань',address:null,point:null,phone:null,site:'https://kazan.tatmetiz.ru/product/1',hours:null,source:'https://kazan.tatmetiz.ru/product/1',checkedAt:'',price:7000,image:null,status:'website',distanceKm:null,sourceAvailability:'unknown'};
const verifiedShop={id:'shop',kind:'store',title:'Татметиз',description:'',category:'Дом и ремонт',city:'Казань',address:'ул. Фатыха Амирхана, 25',point:{lat:55.83,lng:49.13},phone:null,site:'https://kazan.tatmetiz.ru',hours:null,source:'https://kazan.tatmetiz.ru',checkedAt:'',price:null,image:null,status:'organization',distanceKm:null,locationEvidence:'confirmed-point'};
const [located]=matchSellerLocations([catalogOffer],[verifiedShop]);
assert.deepEqual(located.point,verifiedShop.point);assert.equal(located.address,verifiedShop.address);assert.equal(located.status,'website');assert.equal(located.sourceAvailability,'unknown');
const unverified={...verifiedShop,status:'website',locationEvidence:'unverified'};
assert.equal(matchSellerLocations([catalogOffer],[unverified])[0].point,null);
const incompleteChain={...verifiedShop,title:'Мега Крепёж',site:'https://megakrepezh.ru',sellerLocationGroupComplete:false};
const chainOffer={...catalogOffer,site:'https://megakrepezh.ru/product/1',source:'https://megakrepezh.ru/product/1'};
assert.equal(matchSellerLocations([chainOffer],[incompleteChain])[0].point,null,'do not guess a product branch when the seller has multiple locations');
const completeSeller={...verifiedShop,site:'https://autocraft-kzn.ru',sellerLocationGroupComplete:true};
assert.deepEqual(matchSellerLocations([{...catalogOffer,site:'https://autocraft-kzn.ru/product/1'}],[completeSeller])[0].point,completeSeller.point);
const {catalogAndWebParallel}=await bundled('lib/catalog-first.ts');
let webCalls=0;
let catalogCalls=0,webStarted=false,releaseCatalog;
const fromCatalog={hits:[catalogOffer],status:'seller-catalogs'};
const parallelResult=await catalogAndWebParallel(async()=>{catalogCalls++;return new Promise(resolve=>{releaseCatalog=()=>resolve(fromCatalog);});},async()=>{webStarted=true;webCalls++;releaseCatalog();return {hits:[{...catalogOffer,id:'external-offer'}],status:'routerai-sonar'};},false);
assert.equal(webStarted,true);
assert.equal(parallelResult.status,'routerai-sonar');
assert.equal(parallelResult.catalogStatus,'seller-catalogs');
assert.equal(parallelResult.hits.length,2);
assert.equal(webCalls,1);
assert.equal(catalogCalls,1);
const partials=[];
let releaseSlowWeb;
const {catalogAndWebParallel:catalogAndWebParallelProgressive}=await bundled('lib/catalog-first.ts');
const progressivePromise=catalogAndWebParallelProgressive(
 async()=>fromCatalog,
 ()=>new Promise(resolve=>{releaseSlowWeb=()=>resolve({hits:[{...catalogOffer,id:'late-web-offer'}],status:'routerai-sonar'});}),
 false,
 partial=>partials.push(partial),
);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(partials.length,1,'the catalog result is emitted before the slower web source');
assert.deepEqual(partials[0].hits.map(hit=>hit.id),['web-offer'],'the catalog result is emitted before the slower web source');
assert.equal(partials[0].status,'pending');
releaseSlowWeb();
const progressive=await progressivePromise;
assert.equal(partials.length,2,'each independently completed source publishes a progressive result');
assert.deepEqual(progressive.hits.map(hit=>hit.id),['web-offer','late-web-offer']);
const webStages=[];
await catalogAndWebParallelProgressive(
 async()=>({hits:[],status:'seller-catalogs'}),
 async onPartial=>{await onPartial({hits:[{...catalogOffer,id:'first-web-offer'}],status:'routerai-sonar'});return {hits:[{...catalogOffer,id:'first-web-offer'},{...catalogOffer,id:'second-web-offer'}],status:'routerai-sonar'};},
 false,
 partial=>webStages.push(partial.hits.map(hit=>hit.id)),
);
assert(webStages.some(stage=>stage.includes('first-web-offer')&&!stage.includes('second-web-offer')),'first web offer must appear before optional seller diversification finishes');
assert(webStages.at(-1).includes('second-web-offer'));
const failedCatalog=await catalogAndWebParallel(async()=>{throw new Error('catalog offline');},async()=>({hits:[catalogOffer],status:'routerai-sonar'}),false);
assert.equal(failedCatalog.hits.length,1,'external search survives catalog failure');
assert.equal(failedCatalog.catalogStatus,'unavailable');
const failedWeb=await catalogAndWebParallel(async()=>fromCatalog,async()=>{throw new Error('web unavailable');},false);
assert.equal(failedWeb.hits.length,1,'catalog results survive external search failure');
assert.equal(failedWeb.status,'unavailable');
let categoryWebCalls=0;
const categoryResult=await catalogAndWebParallel(async()=>fromCatalog,async()=>{categoryWebCalls++;return {hits:[],status:'routerai-sonar'};},true);
assert.equal(categoryWebCalls,0,'category browsing must not invoke paid web search');
assert.equal(categoryResult.hits.length,1);
console.log('PASS: seller catalog and external web search run in parallel; each source fails independently; category browsing stays local-only.');

const {hitShop,mapHitShop,routeHit}=await bundled('lib/city-search.ts');
const {localDiscovery}=await bundled('lib/discovery.ts');
const localShop={id:'local-shop',name:'Проверенный продавец',category:'Дом и ремонт',description:'',contact:'',phone:'',email:'',city:'Казань',street:'ул. Тестовая, 1',lat:55.8,lng:49.1,hours:'',site:'https://seller.example',photos:[],source:'https://seller.example',status:'connected',demo:false,addressConfirmed:true,visibility:'public'};
const localProduct={id:'local-product',storeId:localShop.id,name:'Дрель тестовая',category:'Дом и ремонт',brand:'',model:'',description:'',features:'',price:7000,quantity:null,stockConfirmed:false,sku:'',published:true,photos:[],keywords:'дрель',demo:false};
const near={lat:55.81,lng:49.11};
const unconfirmedOffer=localDiscovery([localProduct],[localShop],'дрель','Казань',near).offers[0];
assert.equal(unconfirmedOffer.confirmed,false,'a public website listing without seller-confirmed stock remains unconfirmed');
assert.notEqual(unconfirmedOffer.distanceKm,null,'a confirmed seller address can show distance even when stock is unknown');
assert.notEqual(localDiscovery([{...localProduct,quantity:2,stockConfirmed:true}],[localShop],'дрель','Казань',near).offers[0].distanceKm,null,'seller-confirmed stock may use the separately confirmed shop location');
const {journeyIntent}=await bundled('lib/journey-intent.ts');
assert.deepEqual(journeyIntent('дрель по дороге до Кремлёвской 1'),{destination:'Кремлёвской 1',origin:'',routeOnly:false,query:'дрель'});
assert.deepEqual(journeyIntent('когтерез по дороге в центр'),{destination:'центр',origin:'',routeOnly:false,query:'когтерез'});
console.log('PASS: route destination phrases are removed from product query for both «до» and «в».');
const mapProductHit={id:'web-offer',kind:'product',title:'Дрель модели X',description:'Товарная карточка',category:'Дом и ремонт',city:'Казань',address:'ул. Примерная, 1',point:{lat:55.8,lng:49.1},phone:'+7 843 000-00-00',site:'https://seller.example/product/x',hours:null,source:'https://seller.example/product/x',checkedAt:'',price:7000,image:'https://seller.example/x.jpg',status:'website',distanceKm:null,locationEvidence:'confirmed-point',seller:'Магазин инструментов'};
const mapLocation=hitShop(mapProductHit);
assert.equal(mapLocation.name,'Магазин инструментов','a product pin must identify its seller, not repeat the product title');
assert.equal(mapLocation.street,'ул. Примерная, 1');assert.equal(mapLocation.addressConfirmed,true);
assert.equal(mapLocation.photos.length,0,'product photos must not be presented as store photos');
const linked=matchSellerLocations([{...mapProductHit,point:null,address:null,locationEvidence:'unverified'}],[{id:'verified-shop',kind:'store',title:'Магазин инструментов',description:'',category:'Дом и ремонт',city:'Казань',address:'ул. Примерная, 1',point:{lat:55.8,lng:49.1},phone:'+7 843 000-00-00',site:'https://seller.example',hours:null,source:'https://seller.example',checkedAt:'',price:null,image:null,status:'organization',distanceKm:null,locationEvidence:'confirmed-point',shop:{id:'verified-shop',name:'Магазин инструментов',category:'Дом и ремонт',description:'',contact:'',phone:'+7 843 000-00-00',email:'',city:'Казань',street:'ул. Примерная, 1',lat:55.8,lng:49.1,hours:'',site:'https://seller.example',photos:[],source:'https://seller.example',status:'connected',demo:false,addressConfirmed:true,visibility:'public'}}])[0];
assert.equal(linked.shop?.id,'verified-shop','a matched product should reuse the verified seller location');
assert.equal(hitShop(linked).id,'verified-shop','map pin and route should use the seller location identity');
const tatmetizProduct={...mapProductHit,site:'https://kazan.tatmetiz.ru/shop/tool',source:'https://kazan.tatmetiz.ru/shop/tool',seller:'kazan.tatmetiz.ru'};
const tatmetizLocation={...mapProductHit,id:'tatmetiz-osm',kind:'store',title:'Татметиз',site:'https://kazan.tatmetiz.ru/',source:'https://kazan.tatmetiz.ru/',price:null,image:null,status:'organization'};
const deduplicatedMapIds=new Set([mapHitShop(tatmetizProduct,[tatmetizProduct,tatmetizLocation]).id,mapHitShop(tatmetizLocation,[tatmetizProduct,tatmetizLocation]).id]);
assert.equal(deduplicatedMapIds.size,1,'catalog products and their known seller should share one map point');
const ownedTatmetizProduct={...tatmetizProduct,status:'seller-confirmed',address:'ул. Примерная, 1',point:{lat:55.8,lng:49.1},locationEvidence:'confirmed-point'};
assert.equal(mapHitShop(ownedTatmetizProduct,[ownedTatmetizProduct,tatmetizLocation]).id,tatmetizLocation.id,'owned catalog products should use the same confirmed seller pin');
assert.notEqual(mapHitShop(ownedTatmetizProduct,[ownedTatmetizProduct,{...tatmetizLocation,sellerLocationGroupComplete:false}]).id,tatmetizLocation.id,'do not merge products into an ambiguous multi-location seller');
const taggedTatmetizProduct={...ownedTatmetizProduct,locationSource:'https://www.openstreetmap.org/way/281909411'};
assert.equal(mapHitShop(taggedTatmetizProduct,[taggedTatmetizProduct,{...tatmetizLocation,locationSource:taggedTatmetizProduct.locationSource}]).id,tatmetizLocation.id,'catalog location provenance should connect the exact mapped seller branch');
assert.equal(mapHitShop(taggedTatmetizProduct,[taggedTatmetizProduct,{...tatmetizLocation,site:null,source:taggedTatmetizProduct.locationSource}]).id,tatmetizLocation.id,'an exact OSM point source may connect even when the OSM record has no seller website');
const attachedTatmetizProduct={...tatmetizProduct,shop:{...localShop,id:'local-tatmetiz',site:'https://kazan.tatmetiz.ru/',street:'ул. Примерная, 1',lat:55.8,lng:49.1,addressConfirmed:true},point:null,address:'ул. Примерная, 1'};
assert.equal(mapHitShop(attachedTatmetizProduct,[attachedTatmetizProduct,tatmetizLocation]).id,tatmetizLocation.id,'a product with an attached verified shop should share its matching OSM seller pin');
const routeUrl=new URL(routeHit(mapProductHit,{lat:55.81,lng:49.11}));
assert.equal(routeUrl.searchParams.get('rtext'),'55.81,49.11~55.8,49.1','Yandex route should include the user origin when permission was granted');
console.log('PASS: mapped product pins resolve to the seller location and preserve product-to-shop linkage.');
