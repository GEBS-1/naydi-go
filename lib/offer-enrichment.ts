import {extractOffers} from './offer-extraction';
import {fetchSource} from './source-fetch';
import type {SearchHit} from './city-search';

/** Read a few direct item pages, keeping facts scoped to that exact item URL. */
export async function enrichOffers(hits:SearchHit[]){
 const urls=[...new Set(hits.filter(h=>h.kind==='product'&&h.evidence==='source-page'&&(!h.description||!h.model||!h.characteristics?.length)).map(h=>h.site||h.source))].slice(0,3);
 const facts=new Map<string,SearchHit>();
 await Promise.all(urls.map(async url=>{const html=await fetchSource(url);if(!html)return;const items=extractOffers(html,url,'');const exact=items.filter(h=>h.kind==='product'&&(h.site||h.source)===url);if(exact.length===1)facts.set(url,exact[0]);}));
 return hits.map(h=>{const f=facts.get(h.site||h.source);return !f||h.kind!=='product'?h:{...h,description:f.description||h.description,image:f.image||h.image,model:f.model||h.model,brand:f.brand||h.brand,characteristics:f.characteristics?.length?f.characteristics:h.characteristics,rating:f.rating||h.rating};});
}
