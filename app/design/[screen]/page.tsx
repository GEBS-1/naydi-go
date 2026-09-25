import DesignScreen from '../screen';
export function generateStaticParams(){return ['home','search','product','store','map','business','create','messages'].map(screen=>({screen}));}
export default async function Page({params}:{params:Promise<{screen:string}>}){const {screen}=await params;return <DesignScreen screen={screen}/>;}
