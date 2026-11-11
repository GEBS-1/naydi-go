// Extract a destination hint, never coordinates. The user confirms a geocoder result.
export function journeyIntent(text:string){
 const direct=text.match(/^\s*(?:построй(?:те|ить)?|проложи(?:те|ть)?)\s+маршрут(?:\s+от\s+(.+?))?(?:\s+(?:в|до)\s+(.+?))?[.!?]?\s*$/iu);
 if(direct&&!/по\s+(?:дороге|пути)/iu.test(text))return {destination:direct[2]||'',origin:direct[1]||'',query:'',routeOnly:true};
 const pattern=/(?:(?:еду|едем|ехать)\s+(?:в|до)\s+|(?:по дороге|по пути)\s+(?:в|до)\s+|в сторону\s+(?:района\s+)?)([^,;.!?]+?)(?=\s+(?:найди|найти|купить|нужн|по дороге|по пути|до\s+\d)|[,;.!?]|$)/iu;
 const match=text.match(pattern);
 const destination=match?.[1]?.trim()||'';
 const query=text.replace(pattern,' ').replace(/по\s+(дороге|пути)/giu,' ').replace(/^[\s,;]+|[\s,;]+$/g,'').replace(/^(?:найди|найти|купить)\s+/iu,'').replace(/\s+/g,' ').trim();
 return {destination,origin:'',query:query||text,routeOnly:false};
}
