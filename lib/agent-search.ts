import {matchesMerchantSource} from './merchant-search-sources';
import {env} from '@/lib/server-env';
import {searchZone} from './nearby-topics';
import {searchChargeable} from './search-completion';
import {queryCity} from './query-city';
import {withUsage,currentUsage} from './search-usage';
import {cleanCity,cityKey} from './location';
import {dialogContext} from './dialog-context';
import {matchSellerLocations} from './merchant-match';
import {db} from '@/db';
import {type SearchContext} from './search-context';
import {toSearchResult,type SearchResult} from './search-result';
import {publicIndex} from './discovery-server';
import {onMap,localDiscovery} from './discovery';
import {searchCatalogs,catalogLocationHits} from './seller-catalogs';
import {searchWebPlaces} from './web-places';
import {normalize} from './search';
import {parseIntent,deduplicate,matchesServicePlace,safeHTTP,type SearchHit,type GeoPoint,type Intent} from './city-search';
import {findOrganizations,hidePrivate,reverseLocation,type Bounds} from './osm-provider';
import {searchWeb} from './web-search-provider';
import {searchNearbyMerchants} from './router-web-provider';
import {categories} from './model';
import {routerCall} from './router-gateway';
import {offerAvailabilityAdjustment,relevantOffers} from './offer-relevance';
import {catalogAndWebParallel} from './catalog-first';
import {persistDiscoveredOffers,readDiscoveredOffers} from './discovered-offers';
import {extractOffers} from './offer-extraction';
import {fetchSource} from './source-fetch';

export type AgentSearchRequest={resume?:boolean;query:string;city:string;near?:GeoPoint;bounds?:Bounds;context?:SearchContext};
export type AgentSearchResponse={
  searchArea?:{city:string;zone:string};searchKey?:string;chargeable?:boolean;hits:SearchHit[];results:SearchResult[];context:SearchContext;intent:Intent;
  phase:'local'|'complete';sources:{osm:string;web:string;catalog?:string};
  timing:{parseMs:number;localMs:number;externalMs:number;totalMs:number;agentMs?:number};
  warnings:string[];usage?:ReturnType<typeof currentUsage>;agent?:{mode:'nearby-business';steps:string[]};
};

export function isCategoryBrowse(query:string){return categories.some(category=>normalize(category)===normalize(query));}

function relevanceScore(hit:SearchHit,query:string){
  const hay=normalize(`${hit.title} ${hit.category} ${hit.description}`),q=normalize(query);
  let score=hit.kind==='product'?120:0;
  const groups:[RegExp,string[]][]=[
    [/свечн[а-яё]*\s+(?:ключ|головк)|(?:ключ|головк)[а-яё]*\s+(?:для\s+)?свеч/u,['инструмент','крепеж','крепёж','hardware','doityourself','trade','автоинструмент']],
    [/дрел|перфорат|шурупов|инструмент|креп[её]ж/u,['инструмент','крепеж','крепёж','hardware','doityourself','trade','строй','хозтовар']],
    [/авто|машин|аккумулятор|компрессор|toyota|rav4/u,['авто','запчаст','car parts','tyres','шин','аккумулятор']],
    [/корм|кош|кот|собак|зоотовар/u,['зоо','pet','вет','корм']],
    [/наушник|телефон|ноутбук|электрон|видеокарт|видеокарта/u,['электрон','electronics','computer','mobile phone','цифров']],
    [/велосипед|спорт|мяч/u,['велосипед','bicycle','спорт','sports']],
    [/цвет|букет/u,['цвет','florist']],
    [/сад|дач|семен|растени/u,['сад','garden','agrarian','семен']],
    [/ламп|свет/u,['ламп','свет','lighting']],
  ];
  const terms=groups.find(([pattern])=>pattern.test(q))?.[1]||[];
  for(const term of terms)if(hay.includes(normalize(term)))score+=18;
  const tokens=q.split(' ').filter(token=>token.length>3&&!['найди','купить','казани','москве','самаре','рядом'].includes(token));
  for(const token of tokens)if(hay.includes(token.slice(0,Math.max(4,token.length-2))))score+=8;
  if(hit.point&&hit.address)score+=3;if(hit.site)score+=2;if(hit.phone)score+=1;
  score+=offerAvailabilityAdjustment(hit);
  if(hit.distanceKm!==null&&hit.distanceKm!==undefined){
    if(hit.distanceKm<=1)score+=40;else if(hit.distanceKm<=3)score+=28;else if(hit.distanceKm<=7)score+=16;else if(hit.distanceKm<=15)score+=8;
  }
  return score;
}

/** Optional cheap agent step: pick focus labels for nearby businesses. Never invents shops. */
async function agentFocus(query:string,city:string):Promise<{labels:string[];ms:number}>{
  // This is an optional paid enrichment step. Keep the default search path fast
  // and inexpensive; enable explicitly after validating its value in staging.
  if(!query.trim()||isCategoryBrowse(query)||!env.ROUTERAI_API_KEY||env.AGENT_SEARCH!=='on')return {labels:[],ms:0};
  const start=performance.now();
  try{
    const answer=await routerCall({
      model:env.ROUTERAI_MODEL||'qwen/qwen3-30b-a3b-instruct-2507',
      max_tokens:200,temperature:0,response_format:{type:'json_object'},
      messages:[
        {role:'system',content:'Ты помощник локального поиска. Верни JSON {"labels":["..."]} — до 4 коротких меток категорий или типов бизнеса рядом с запросом (например электроника, магазин инструментов). Не называй конкретные магазины, адреса, цены и наличие. Не выдумывай факты.'},
        {role:'user',content:JSON.stringify({query,city})},
      ],
    });
    const parsed=JSON.parse(answer.choices?.[0]?.message.content||'{}') as {labels?:unknown};
    const labels=Array.isArray(parsed.labels)?parsed.labels.map(x=>String(x).trim()).filter(Boolean).slice(0,4):[];
    return {labels,ms:performance.now()-start};
  }catch{return {labels:[],ms:performance.now()-start};}
}

export async function runAgentSearch(input:AgentSearchRequest,emit?:(r:AgentSearchResponse)=>void):Promise<AgentSearchResponse>{
  const explicit=await queryCity(input.query);
  if(explicit)input={...input,query:explicit.query,city:explicit.city,near:cityKey(explicit.city)===cityKey(input.city)?input.near:undefined,context:undefined};
  const city=cleanCity(input.city);
  if(city.length<2)throw Error('Выберите город для поиска.');
  return withUsage(()=>runAgentMeasured({...input,city},emit));
}

async function runAgentMeasured(input:AgentSearchRequest,emit?:(r:AgentSearchResponse)=>void):Promise<AgentSearchResponse>{
  const steps:string[]=['intent','web-search','nearby-points','card-normalization','rank'];
  const started=performance.now();
  const dialog=input.resume&&input.context?{context:input.context,question:undefined}:await dialogContext(input.query,input.context);
  const context=dialog.context,intent=parseIntent(context.query,input.city),parseMs=performance.now()-started;
  const focus=await agentFocus(intent.query||input.query,input.city);
  if(focus.labels.length)steps.push('agent-focus');

  const constrain=(list:SearchHit[])=>list
    .filter(h=>!context.newOnly||h.product?.condition!=='used')
    .filter(h=>(context.maxPrice===undefined||h.price===null||h.price<=context.maxPrice)&&(context.radiusKm===undefined||h.distanceKm===null||h.distanceKm<=context.radiusKm))
    .sort((a,b)=>context.sort==='price-distance'
      ?((a.price??Infinity)-(b.price??Infinity)||((a.distanceKm??Infinity)-(b.distanceKm??Infinity)))
      :context.sort==='price'
        ?(a.price??Infinity)-(b.price??Infinity)
        :input.near
          ?Number(!a.point||!a.address)-Number(!b.point||!b.address)
            ||(a.distanceKm??Infinity)-(b.distanceKm??Infinity)
            ||(a.kind==='product'?0:1)-(b.kind==='product'?0:1)
            ||relevanceScore(b,intent.query)-relevanceScore(a,intent.query)
          :Number(!a.point||!a.address)-Number(!b.point||!b.address)||relevanceScore(b,intent.query)-relevanceScore(a,intent.query));

  const present=(r:AgentSearchResponse)=>{
    r.usage=currentUsage();
    r.searchArea={city:input.city,zone:searchZone(input.near)};
    let organizations=0;
    const candidates=intent.kind==='service'
      ?r.hits.filter(h=>h.kind==='page'||(h.kind==='service'&&h.status==='seller-confirmed')||matchesServicePlace(h,intent))
        .map(h=>h.kind==='store'?{...h,kind:'service' as const}:h)
      :r.hits;
    r.hits=constrain(relevantOffers(candidates,intent.query,input.city).filter(h=>input.bounds||!h.city||cityKey(h.city)===cityKey(input.city)))
      .filter(h=>h.status!=='organization'||!h.id.startsWith('osm:')||++organizations<=16);
    r.results=r.hits.map(toSearchResult).filter((h):h is SearchResult=>h!==null);
    r.agent={mode:'nearby-business',steps};
    return r;
  };

  const index=await publicIndex();
  const discoveredCache=await readDiscoveredOffers(input.city,intent.query,input.near).catch(()=>[] as SearchHit[]);
  const local=localDiscovery(index.products,index.shops,intent.query,input.city,input.near);
  const hits:SearchHit[]=[...discoveredCache,...(intent.kind==='service'?[]:catalogLocationHits(intent.query,input.city)),...local.offers.map(o=>({id:'owned:'+o.id,kind:o.kind,title:o.product.name,description:o.product.description,category:o.product.category,city:o.shop.city,address:o.shop.street||null,point:onMap(o.shop)?{lat:o.shop.lat,lng:o.shop.lng}:null,phone:o.shop.phone||null,site:o.shop.site||null,hours:o.shop.hours||null,source:o.source,checkedAt:o.checkedAt||'',price:o.product.price,image:o.product.photos[0]||null,status:'seller-confirmed' as const,distanceKm:o.distanceKm,product:o.product,shop:o.shop,locationEvidence:onMap(o.shop)?'confirmed-point' as const:'unverified' as const,sourceAvailability:o.confirmed?(o.product.quantity!>0?'in_stock' as const:'out_of_stock' as const):'unknown' as const}))];
  if(intent.query){
    // A mapped organization remains a useful route fallback while live OSM is
    // unavailable. Its cached category never proves that this item is in stock.
    const rows=await db().prepare('SELECT data,category FROM external_places WHERE city=? AND checked_at>? LIMIT 1500')
      .bind(normalize(input.city),Date.now()-45*86400000).all<{data:string;category:string}>();
    for(const r of rows.results){
      const h=JSON.parse(r.data) as SearchHit;
      if(h.id.startsWith('osm:')&&h.point&&h.address&&!h.locationEvidence)h.locationEvidence='confirmed-point';
      if(intent.category==='Освещение'&&!/свет|ламп|электр|хоз|строй|инструм|оборуд/iu.test(`${h.title} ${h.category}`))continue;
      const tags=intent.selectors.flatMap(s=>s.match(/="([^"]+)"/u)?.[1]||[]);
      const related=!!intent.category&&normalize(r.category)===normalize(intent.category)||tags.includes(h.category)||normalize(h.title).includes(normalize(intent.query));
      if(cityKey(h.city)===cityKey(input.city)&&related)hits.push(h);
    }
  }
  // Published merchant inventory participates alongside independently found nearby businesses.

  let result:AgentSearchResponse={
    results:[],context,hits:deduplicate(await hidePrivate(hits),input.near),intent,phase:'local',
    sources:{osm:'pending',web:'pending',catalog:'pending'},
    timing:{parseMs,localMs:performance.now()-started,externalMs:0,totalMs:performance.now()-started,agentMs:focus.ms},
    warnings:dialog.question?[dialog.question]:[],agent:{mode:'nearby-business',steps},
  };
  present(result);emit?.(result);

  if(intent.clarification.length||!intent.query){
    result={...result,phase:'complete',sources:{osm:'skipped',web:'skipped',catalog:'skipped'}};emit?.(result);return result;
  }

  const webQuery=context.maxPrice===undefined
    ?intent.query
    :intent.query.replace(/(?:до|не дороже|бюджет)\s*\d[\d\s]*(?:[,.]\d{1,2})?\s*(?:тыс(?:яч)?\.?|руб(?:лей)?|₽)?/giu,'').trim()+` до ${context.maxPrice} рублей`;
  const browse=isCategoryBrowse(input.query);
  const agentIntent={...intent,query:[intent.query,...focus.labels].filter(Boolean).join(' ')};
  const ext=performance.now();
  const sellerTask=()=>searchCatalogs(intent.query,input.city,input.near);
  const publishSourceHits=async(partial:{hits:SearchHit[];status:string;catalogStatus:string})=>{
    const partialHits=deduplicate(await hidePrivate(matchSellerLocations(
      [...result.hits,...partial.hits],
      [...result.hits,...partial.hits],input.near,
    )),input.near);
    const warnings=[...result.warnings];
    if(partial.status==='unavailable'||partial.catalogStatus==='unavailable'||partial.catalogStatus==='busy'||partial.catalogStatus==='cooldown')
      warnings.push('Некоторые источники ещё недоступны. Показаны уже полученные предложения.');
    result=present({...result,hits:partialHits,phase:'local',sources:{osm:'pending',web:partial.status,catalog:partial.catalogStatus},
      timing:{...result.timing,externalMs:performance.now()-ext,totalMs:performance.now()-started},warnings});
    emit?.(result);
  };
  const area=reverseLocation(input.near);
  const webTask=intent.kind==='service'
    ?Promise.resolve({hits:[] as SearchHit[],status:'osm-services',catalogStatus:'skipped'})
    :catalogAndWebParallel(sellerTask,async onPartial=>searchWeb(webQuery,input.city,[],input.near,await area,onPartial),browse,publishSourceHits);
  const nearbyBounds=input.near?[input.near.lat-.07,input.near.lng-.12,input.near.lat+.07,input.near.lng+.12] as Bounds:undefined;
  const osmPromise=findOrganizations(agentIntent,input.city,input.bounds||nearbyBounds).catch(()=>({hits:[] as SearchHit[],status:'unavailable'})).then(async osm=>{if(osm.hits.length)await publishSourceHits({hits:osm.hits,status:result.sources.web,catalogStatus:result.sources.catalog||'pending'});return osm;});
  const placePromise=browse?Promise.resolve({hits:[] as SearchHit[],status:'skipped'}):area.then(a=>searchWebPlaces(intent.query,input.city,input.near,a)).then(async places=>{if(places.hits.length)await publishSourceHits({hits:places.hits,status:result.sources.web,catalogStatus:result.sources.catalog||'pending'});return places;});
  // Stream each seller/web source as it finishes; the slower one must not hold
  // back cards already extracted from the other source.
  const [osm,web,places]=await Promise.all([osmPromise,webTask,placePromise]);
  // Use only an already verified public store location, and only when the seller's
  // site domain matches exactly. A match gives the seller point, not branch stock.
  const verifiedStoreLocations:SearchHit[]=index.shops.filter(s=>s.visibility==='public'&&!s.demo&&s.addressConfirmed===true&&!!s.street?.trim()&&Number.isFinite(s.lat)&&Math.abs(s.lat)<=85&&Number.isFinite(s.lng)&&Math.abs(s.lng)<=180).map(s=>({
    id:'verified-store:'+s.id,kind:'store',title:s.name,description:s.description,category:s.category,city:s.city,address:s.street,
    point:{lat:s.lat,lng:s.lng},phone:s.phone||null,site:s.site||null,hours:s.hours||null,source:s.source||s.site||'',checkedAt:'',price:null,image:s.photos[0]||null,status:'organization',distanceKm:null,shop:s,locationEvidence:'confirmed-point',
  }));
  const organizations=await hidePrivate(relevantOffers([...osm.hits,...places.hits],intent.query,input.city)
    .filter(h=>intent.kind!=='service'||h.kind==='page'||matchesServicePlace(h,intent)));
  // Older discovery entries can classify a direct seller product page as a
  // store. Re-read at most two such pages and use only observed product facts.
  if(intent.kind==='product'&&![...result.hits,...web.hits,...organizations].some(h=>h.kind==='product'&&h.price!==null&&h.address&&h.evidence==='source-page')){
    const productPages=[...new Set([...organizations,...result.hits].filter(h=>h.kind==='store').map(h=>safeHTTP(h.site||h.source)).filter((url):url is string=>!!url&&/\/\d{3,}\/?$/u.test(new URL(url).pathname)))].slice(0,2);
    const recovered=(await Promise.all(productPages.map(async url=>{
      const html=await fetchSource(url);
      return html?relevantOffers(extractOffers(html,url,input.city),intent.query,input.city):[];
    }))).flat();
    if(recovered.length)web.hits.push(...recovered);
  }
  const knownLocations=[...organizations,...result.hits,...verifiedStoreLocations,...web.hits];
  const firstOffers=matchSellerLocations([...result.hits,...web.hits],knownLocations,input.near);
  const products=firstOffers.filter(h=>h.kind==='product'&&h.sourceAvailability!=='out_of_stock');
  const sellerPoints=new Set(products.filter(h=>h.point&&h.address).map(h=>h.address));
  if(!browse&&intent.kind==='product'&&sellerPoints.size<2&&performance.now()-started<30000){
    const sites=[...new Set(products.filter(h=>!h.point).flatMap(h=>{
      const url=safeHTTP(h.site||h.source);
      if(!url)return [];
      const parsed=new URL(url);
      if(['t.me','telegram.me','vk.com','vk.ru','m.vk.com','www.vk.com','www.vk.ru'].includes(parsed.hostname))return [];
      return matchesMerchantSource(url,url)?[parsed.origin]:[];
    }))].slice(0,3);
    if(sites.length){
      const addresses=await searchWebPlaces(intent.query,input.city,input.near,await area,sites).catch(()=>({hits:[]}));
      const verified=addresses.hits.filter(h=>h.kind==='store'&&h.point&&h.address&&h.locationEvidence==='confirmed-point');
      knownLocations.push(...verified);
      if(verified.length)await publishSourceHits({hits:verified,status:web.status,catalogStatus:web.catalogStatus});
    }else{
      const extra=await searchNearbyMerchants(webQuery,input.city,knownLocations,input.near,await area).catch(()=>[]);
      if(extra.length)await publishSourceHits({hits:extra,status:web.status,catalogStatus:web.catalogStatus});
    }
  }

  const placeRecords=organizations.filter(h=>h.kind==='store'||h.kind==='service');
  if(placeRecords.length){
    await db().batch(placeRecords.map(h=>db().prepare(
      'INSERT INTO external_places(id,city,category,data,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET city=excluded.city,category=excluded.category,data=excluded.data,checked_at=excluded.checked_at'
    ).bind(h.id,normalize(h.city),intent.category,JSON.stringify(h),new Date(h.checkedAt).getTime())));
  }

  const completedHits=deduplicate(await hidePrivate([
    ...organizations,
    ...matchSellerLocations([...result.hits,...web.hits.filter(h=>!result.hits.some(existing=>existing.id===h.id))],knownLocations,input.near),
  ]),input.near);
  // Retain confirmed local product offers so the next search can show them immediately.
  // This is a discovery index, not seller-owned inventory; seller stock stays unconfirmed.
  await persistDiscoveredOffers(input.city,completedHits).catch(()=>0);
  result={
    ...result,
    hits:completedHits,
    phase:'complete',sources:{osm:osm.status==='unavailable'&&places.hits.length?places.status:osm.status,web:intent.kind==='service'?places.status:web.status,catalog:web.catalogStatus},
    timing:{...result.timing,externalMs:performance.now()-ext,totalMs:performance.now()-started,agentMs:focus.ms},
    warnings:[],agent:{mode:'nearby-business',steps},
  };
  // Provider internals belong in source health/admin telemetry, not buyer-facing
  // result cards. A failed source is isolated; show only results that did arrive.
  if(['unavailable','busy','cooldown'].includes(web.catalogStatus)||web.status==='unavailable'||(intent.kind==='service'&&places.status==='unavailable'))result.warnings.push('Не все источники ответили. Показаны доступные предложения; цену и наличие можно уточнить у продавца.');
  if(dialog.question)result.warnings.push(dialog.question);
  if(context.maxPrice!==undefined)result.warnings.push(`Бюджет до ${context.maxPrice} ₽: предложения без цены и организации показаны отдельно; соответствие бюджету не подтверждено.`);
  if(context.newOnly)result.warnings.push('У источников нет подтверждённого состояния товара. Условие «только новые» требует проверки у продавца.');
  if(context.sort==='price-distance'&&!input.near)result.warnings.push('Чтобы показать ближе, укажите адрес или разрешите геолокацию. Без координат сортируем только известные цены.');
  if(context.radiusKm&&!input.near)result.warnings.push('Для ограничения радиуса укажите начальный адрес или разрешите геолокацию.');
  present(result);

  const localResults=result.hits.filter(h=>h.kind!=='page'&&h.point&&h.address&&h.locationEvidence==='confirmed-point');
  if(!localResults.length&&result.hits.some(h=>h.kind==='page'||h.locationEvidence==='unverified')){
    result.warnings.unshift(`В ${input.city} не удалось подтвердить местный магазин для найденных интернет-страниц. Они показаны отдельно как интернет-источники; адрес продажи и наличие в филиале пока неизвестны.`);
  }
  result.chargeable=browse?false:searchChargeable(result.hits.length,result.sources);
  if(!browse&&!result.chargeable)result.warnings.push('Источники не ответили, подходящих результатов в индексе нет. Поиск не списан из вашего лимита.');
  if(context.maxPrice!==undefined&&!result.hits.some(h=>h.kind==='product'&&h.price!==null)){
    result.warnings.unshift(`Не нашли подтверждённых предложений с опубликованной ценой до ${context.maxPrice} ₽. Ниже — источники и магазины, где можно уточнить цену.`);
  }
  await db().batch([
    db().prepare('INSERT INTO searches(id,query,result_count,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),input.query,result.hits.length,new Date().toISOString()),
    db().prepare('INSERT INTO search_metrics(id,data,created_at) VALUES(?,?,?)').bind(crypto.randomUUID(),JSON.stringify({city:input.city,category:intent.category,timing:result.timing,sources:result.sources,count:result.hits.length,usage:currentUsage(),agent:result.agent}),Date.now()),
  ]);
  emit?.(result);return result;
}
