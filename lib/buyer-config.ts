import {env} from 'cloudflare:workers';
export type BuyerProvider='telegram'|'max';
export function maxApiBase(){return env.MAX_API_BASE_URL==='https://platform-api.max.ru'?'https://platform-api.max.ru':'https://platform-api2.max.ru';}
export function buyerConfig(){return {enabled:env.BUYER_AUTH_ENABLED==='1',quota:env.BUYER_QUOTA_ENABLED==='1',base:env.AUTH_BASE_URL||'https://naydigo.prepromo.ru',payments:env.YOOKASSA_ENABLED==='1',test:env.YOOKASSA_TEST_MODE!=='0',free:10,pro:{price:14900,searches:100,days:30}};}
export function providerReady(provider:BuyerProvider){return buyerConfig().enabled&&!!(provider==='telegram'?env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_BOT_USERNAME&&env.TELEGRAM_WEBHOOK_SECRET:env.MAX_BOT_TOKEN&&env.MAX_BOT_URL&&env.MAX_WEBHOOK_SECRET)&& (provider!=='max'||env.MAX_AUTH_ENABLED==='1');}
