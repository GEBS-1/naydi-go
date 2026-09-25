import Invitation from './ui';
export const metadata={title:'Получить управление магазином — НайдиGo',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <Invitation token={token}/>;}
