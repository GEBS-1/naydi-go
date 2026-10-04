// Extract a destination hint, never coordinates. The user confirms a geocoder result.
export function journeyIntent(text:string){
 const pattern=/(?:(?:еду|едем|ехать)\s+в\s+|(?:по дороге|по пути)\s+в\s+|в сторону\s+(?:района\s+)?)([^,;.!?]+?)(?=\s+(?:найди|найти|купить|нужн|по дороге|по пути|до\s+\d)|[,;.!?]|$)/iu;
 const match=text.match(pattern);
 const destination=match?.[1]?.trim()||'';
 const query=text.replace(pattern,' ').replace(/по\s+(дороге|пути)/giu,' ').replace(/^[\s,;]+|[\s,;]+$/g,'').replace(/^(?:найди|найти|купить)\s+/iu,'').replace(/\s+/g,' ').trim();
 return {destination,query:query||text};
}
