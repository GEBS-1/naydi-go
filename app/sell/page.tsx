import {SellerEntry} from '@/app/business-demo/seller-entry';
export const metadata={title:'Продать товар рядом — НайдиGo',description:'Разместите новый или б/у товар рядом с покупателями. Вход через Telegram или MAX.'};
export default async function SellPage({searchParams}:{searchParams:Promise<{mode?:string}>}){const {mode}=await searchParams;return <SellerEntry storeMode={mode==="store"} localTest={process.env.NODE_ENV==='development'}/>;}
