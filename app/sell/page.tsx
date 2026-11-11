import {SellerEntry} from '@/app/business-demo/seller-entry';
export const metadata={title:'Продать товар рядом — НайдиGo',description:'Разместите новый или б/у товар рядом с покупателями. Вход через Telegram или MAX.'};
export default function SellPage(){return <SellerEntry localTest={process.env.NODE_ENV==='development'}/>;}
