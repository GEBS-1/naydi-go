import Preview from './ui';
export const metadata={title:'Персональная витрина — НайдиGo',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <Preview token={token}/>;}
