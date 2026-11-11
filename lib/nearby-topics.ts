import {cityKey} from './location';
import {normalize} from './search';
import type {GeoPoint} from './city-search';
export function searchZone(near?:GeoPoint){return near?`${Math.floor(near.lat/.025)},${Math.floor(near.lng/.04)}`:'city';}
export function searchIdentity(query:string,city:string,near?:GeoPoint,zoneOverride?:string){return JSON.stringify(['v1',normalize(query),cityKey(city),zoneOverride||searchZone(near)]);}
