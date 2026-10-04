import {actor} from '@/lib/onboarding';
import {db} from '@/db';
import {budgetState} from '@/lib/api-budget';
import {privateResponse} from '@/lib/discovery-server';
export async function GET(){
 if(!(await actor()).admin)return privateResponse({error:'Нужен защищённый вход администратора.'},403);
 try{
  const since=Date.now()-30*86400000;
  const [accounts,searches,top,payments,metrics,budget]=await Promise.all([
   db().prepare('SELECT provider,COUNT(*) AS count FROM buyer_accounts GROUP BY provider').all(),
   db().prepare('SELECT status,COUNT(*) AS count,COUNT(DISTINCT buyer_id) AS identities FROM buyer_searches WHERE created_at>=? GROUP BY status').bind(since).all(),
   db().prepare('SELECT query,COUNT(*) AS count,ROUND(AVG(result_count),1) AS averageResults FROM searches WHERE created_at>=? GROUP BY query ORDER BY count DESC LIMIT 20').bind(new Date(since).toISOString()).all(),
   db().prepare('SELECT test,status,COUNT(*) AS count,SUM(amount) AS kopecks FROM buyer_payments WHERE created_at>=? GROUP BY test,status').bind(since).all(),
   db().prepare('SELECT data FROM search_metrics WHERE created_at>=? ORDER BY created_at DESC LIMIT 1000').bind(since).all<{data:string}>(),budgetState()
  ]);
  const [costs,events,geography,conversion,visitors,applications,searchSummary,inventory]=await Promise.all([
   db().prepare("SELECT provider,model,status,COUNT(*) AS calls,SUM(COALESCE(actual,0))/100.0 AS knownRub,SUM(CASE WHEN actual IS NULL THEN reserved ELSE 0 END)/100.0 AS unresolvedRub,SUM(CASE WHEN created_at>=? THEN COALESCE(actual,0) ELSE 0 END)/100.0 AS todayRub FROM api_calls WHERE month=? GROUP BY provider,model,status").bind(new Date().setUTCHours(0,0,0,0),new Date().toISOString().slice(0,7)).all(),
   db().prepare('SELECT event,city,category,COUNT(*) AS count FROM product_events WHERE created_at>=? GROUP BY event,city,category ORDER BY count DESC LIMIT 100').bind(since).all(),
   db().prepare("SELECT COALESCE(json_extract(data,'$.city'),'Не записан') AS city,COALESCE(json_extract(data,'$.category'),'Не записана') AS category,COUNT(*) AS searches,SUM(CASE WHEN json_extract(data,'$.count')=0 THEN 1 ELSE 0 END) AS empty FROM search_metrics WHERE created_at>=? GROUP BY city,category ORDER BY searches DESC LIMIT 100").bind(since).all(),
   db().prepare("SELECT COUNT(DISTINCT buyer_id) AS paidAccounts,COALESCE(SUM(amount),0)/100.0 AS confirmedRevenueRub FROM buyer_payments WHERE test=0 AND status='succeeded' AND created_at>=?").bind(since).first(),
   db().prepare("SELECT COUNT(*) AS pageSessions,COUNT(DISTINCT day_actor) AS uniqueBrowsers FROM product_events WHERE event='visit' AND created_at>=?").bind(since).first(),
   db().prepare("SELECT status,COUNT(*) AS count FROM connection_requests WHERE created_at>=? GROUP BY status").bind(new Date(since).toISOString()).all(),
   db().prepare('SELECT COUNT(*) AS searches,SUM(CASE WHEN result_count>0 THEN 1 ELSE 0 END) AS searchesWithResults FROM searches WHERE created_at>=?').bind(new Date(since).toISOString()).first<Record<string,number>>(),
   db().prepare("SELECT (SELECT COUNT(*) FROM shops WHERE COALESCE(json_extract(data,'$.demo'),0)=0) AS stores,(SELECT COUNT(*) FROM products p JOIN shops s ON s.id=p.store_id WHERE p.published=1 AND s.visibility='public' AND COALESCE(json_extract(p.data,'$.demo'),0)=0 AND COALESCE(json_extract(p.data,'$.testOnly'),0)=0 AND COALESCE(json_extract(s.data,'$.demo'),0)=0) AS publishedProducts,(SELECT COUNT(*) FROM connection_requests WHERE created_at>=?) AS businessApplications").bind(new Date(since).toISOString()).first<Record<string,number>>()
  ]);
  let ms=0,cache=0,cost=0,unknown=0,count=0;
  for(const row of metrics.results){try{const m=JSON.parse(row.data);ms+=Number(m.timing?.totalMs)||0;cost+=Number(m.usage?.knownCostRub)||0;if(m.usage?.cacheHits>0)cache++;if(!m.usage?.costComplete)unknown++;count++;}catch{}}
  const eventCount=(...names:string[])=>events.results.reduce((sum,row)=>sum+(names.includes(String(row.event))?Number(row.count)||0:0),0);
  const summary={visitors:Number(visitors?.uniqueBrowsers)||0,searches:Number(searchSummary?.searches)||0,searchesWithResults:Number(searchSummary?.searchesWithResults)||0,productViews:eventCount('product_view'),sellerClicks:eventCount('seller','seller_click'),phoneClicks:eventCount('phone_click'),routeClicks:eventCount('route','route_click'),businessApplications:Number(inventory?.businessApplications)||0,stores:Number(inventory?.stores)||0,publishedProducts:Number(inventory?.publishedProducts)||0};
  return privateResponse({periodDays:30,summary,accounts:accounts.results,searches:searches.results,topQueries:top.results,payments:payments.results,budget,costs:costs.results,events:events.results,geography:geography.results,conversion,visitors,applications:applications.results,sample:{count,averageMs:count?Math.round(ms/count):null,withCache:cache,knownCostRub:cost,unknownCostSearches:unknown},notes:['Уникальный браузер — анонимный cookie, а не подтверждённый человек. Основную посещаемость и возвращаемость сверяйте с Яндекс Метрикой.','QA/Playwright и адреса с параметром qa не записываются новым счётчиком.','Метрики: последние 1000 завершённых поисков за 30 дней; это выборка, не финансовый реестр.','Тестовые платежи не являются выручкой. Финансовые агрегаты — за текущий месяц UTC.']});
 }catch{return privateResponse({error:'Не удалось собрать статистику.'},503);}
}
