export type ProductEvent='product_view'|'seller_click'|'phone_click'|'route_click'|'favorite'|'saved_search'|'business_application'|'search_with_results'|'search_without_results';
export function trackProductEvent(event:ProductEvent,city:string,category=''){
 if(typeof window==='undefined'||navigator.webdriver||new URLSearchParams(location.search).has('qa'))return;
 if(location.hostname==='naydigo.prepromo.ru'){
  const ym=(window as Window&{ym?:(counter:number,action:string,goal:string,params?:Record<string,string>)=>void}).ym;
  ym?.(113120246,'reachGoal',event,{city:city.slice(0,100),category:category.slice(0,100)});
 }
 void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,city:city.slice(0,100),category:category.slice(0,100)}),keepalive:true}).catch(()=>{});
}
