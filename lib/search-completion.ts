const unavailable=new Set(['unavailable','busy','cooldown','not-configured']);
/** Empty results after a source failure are not a successful paid search. */
export function searchChargeable(count:number,sources:{osm:string;web:string}){
 return count>0||!Object.values(sources).some(status=>unavailable.has(status));
}
