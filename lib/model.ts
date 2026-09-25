export const categories=['Дом и ремонт','Автотовары','Спорт и хобби','Электроника','Сад и дача','Зоотовары'] as const;
export type Shop={id:string;name:string;category:string;description:string;contact:string;phone:string;email:string;city:string;street:string;lat:number;lng:number;hours:string;site:string;vk?:string;telegram?:string;max?:string;photos:string[];status:'connected'|'reference';source:string;demo:boolean;ownerConfirmed?:boolean;addressConfirmed?:boolean;visibility?:'public'|'draft'};
export type Product={kind?:'product'|'service';id:string;storeId:string;name:string;category:string;brand:string;model:string;description:string;features:string;price:number;quantity:number;stockConfirmed?:boolean;sku:string;published:boolean;photos:string[];keywords:string;demo:boolean;source?:string;checkedAt?:string;priceFrom?:boolean};
export type Inquiry={id:string;storeId:string;productId:string;question:string;answer:string|null;createdAt:string;productName:string;demo:boolean};
export type Claim={id:string;storeId:string;contact:string;message:string;status:string;createdAt:string};
export type Catalog={stores:Shop[];products:Product[];owned:string[];inquiries:Inquiry[];claims:Claim[];favorites:string[];signedIn:boolean;admin:boolean};
export const money=(n:number|null)=>n===null?'Уточнить цену':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
export function availability(p:Product,s?:Shop){return (p as Product & {stockConfirmed?:boolean}).stockConfirmed===false||p.quantity===null||s?.status==='reference'?'Уточнить наличие':p.quantity===0?'Нет в наличии':p.quantity<=3?`Осталось ${p.quantity} шт.`:`В наличии · ${p.quantity} шт.`}
export const route=(s:Shop)=>`https://yandex.ru/maps/?rtext=~${s.lat},${s.lng}&rtt=auto`;
