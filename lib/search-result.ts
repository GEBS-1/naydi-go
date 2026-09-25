import type {SearchHit,GeoPoint} from './city-search';
// A source page without an established offer stays in sources, never masquerades as inventory.
export type SearchResult={id:string;type:'product_offer'|'service_offer'|'classified_ad'|'business_location';title:string;description:string;price:number|null;currency:'RUB'|null;seller:string|null;sourceUrl:string;sourceName:string;address:string|null;coordinates:GeoPoint|null;contacts:{phone:string|null;website:string|null};checkedAt:string|null;availabilityStatus:'confirmed'|'unconfirmed'|'unknown';matchType:'exact'|'similar'|'organization'};
export function toSearchResult(h:SearchHit):SearchResult|null {
 if(h.kind==='page')return null;
 return {id:h.id,type:h.kind==='product'?'product_offer':h.kind==='service'&&h.product?'service_offer':'business_location',title:h.title,description:h.description,price:h.price,currency:h.price===null?null:'RUB',seller:h.shop?.name??(h.status==='organization'?h.title:null),sourceUrl:h.source,sourceName:h.source.includes('openstreetmap.org')?'OpenStreetMap':'Источник продавца',address:h.address,coordinates:h.address?h.point:null,contacts:{phone:h.phone,website:h.site},checkedAt:h.checkedAt||null,availabilityStatus:h.status==='seller-confirmed'?'confirmed':h.status==='website'?'unconfirmed':'unknown',matchType:h.status==='organization'?'organization':'similar'};
}
