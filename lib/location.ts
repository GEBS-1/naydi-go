export function cleanCity(value:unknown){return typeof value==='string'?value.trim().replace(/^г\.?\s+/iu,'').replace(/\s+/g,' ').slice(0,100):'';}
export function cityKey(value:string){return cleanCity(value).toLocaleLowerCase('ru').replace(/ё/g,'е');}
export function detectedCity(cf?:{city?:string;country?:string}){return cf?.country==='RU'?cleanCity(cf.city):'';}
export function preferredCity(manual:unknown,automatic:unknown){return cleanCity(manual)||cleanCity(automatic);}
