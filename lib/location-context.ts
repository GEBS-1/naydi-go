import {cleanCity} from './location';
export type LocationContext={city:string;source:'query'|'manual'|'geolocation'|'ip'|'none'};
export function selectLocation(input:{queryCity?:string;manual?:string;geolocation?:string;ip?:string}):LocationContext{for(const [source,value] of [['query',input.queryCity],['manual',input.manual],['geolocation',input.geolocation],['ip',input.ip]] as const){const city=cleanCity(value);if(city)return {city,source};}return {city:'',source:'none'};}
// Conservative explicit form only; never interpret 'в наличии/магазине/бетоне' as a city.
export function explicitCityCandidate(query:string){if(/по дороге|по пути|еду|маршрут/iu.test(query))return null;const match=query.match(/(?:\s|^)(?:в|во)\s+(?:городе\s+|г\.\s*)?([А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+)?)(?=\s*(?:[.!?]|до\s+\d|рядом|$))/u);return match?{value:match[1],phrase:match[0]}:null;}
