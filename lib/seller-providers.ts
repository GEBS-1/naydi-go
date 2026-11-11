// Shared client/server registry; no credentials or server imports.
export const sellerProviderIds=['telegram','max'] as const;
export type SellerProvider=typeof sellerProviderIds[number];
export function isSellerProvider(value:string):value is SellerProvider{return sellerProviderIds.some(p=>p===value);}
export function sellerProviderLabel(value:string){return ({telegram:'Telegram',max:'MAX'} as Record<string,string>)[value]||value;}
