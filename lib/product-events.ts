export function trackProductEvent(event:'seller'|'route'|'favorite'|'saved_search',city:string,category=''){
 if(typeof window==='undefined'||location.hostname!=='naydigo.prepromo.ru'||navigator.webdriver||new URLSearchParams(location.search).has('qa'))return;
 void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,city:city.slice(0,100),category:category.slice(0,100)}),keepalive:true}).catch(()=>{});
}
