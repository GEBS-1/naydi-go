import {z} from 'zod';
import {sameOrigin} from '@/lib/onboarding';
import {guest,privateResponse,quota} from '@/lib/discovery-server';
import {routerTranscribe} from '@/lib/router-gateway';
import {withUsage} from '@/lib/search-usage';

const input=z.object({audio:z.string().min(100).max(5_400_000).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict();
const MAX_WAV_BYTES=4_000_000,MAX_SECONDS=120;

export async function POST(req:Request){return withUsage(()=>transcribe(req));}
async function transcribe(req:Request){
 try{
  sameOrigin(req);
  const contentLength=Number(req.headers.get('content-length')||0);
  if(contentLength>5_600_000)return privateResponse({error:'Запись слишком длинная. Ограничение — 2 минуты.'},413);
  const reader=req.body?.getReader();if(!reader)throw Error('Не получена запись.');
  let size=0,raw='';const decoder=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5_600_000){await reader.cancel();return privateResponse({error:'Запись слишком длинная. Ограничение — 2 минуты.'},413);}raw+=decoder.decode(value,{stream:true});}
  raw+=decoder.decode();
  const {audio}=input.parse(JSON.parse(raw));
  const decoded=atob(audio),bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  if(bytes.length<44||bytes.length>MAX_WAV_BYTES||String.fromCharCode(...bytes.subarray(0,4))!=='RIFF'||String.fromCharCode(...bytes.subarray(8,12))!=='WAVE')throw Error('Неверный формат аудио. Запустите запись ещё раз.');
  const view=new DataView(bytes.buffer),channels=view.getUint16(22,true),sampleRate=view.getUint32(24,true),bits=view.getUint16(34,true),dataBytes=view.getUint32(40,true);
  if(channels!==1||sampleRate!==16000||bits!==16||dataBytes+44!==bytes.length)throw Error('Не удалось подготовить аудио. Попробуйте другой браузер.');
  const durationSeconds=dataBytes/(sampleRate*channels*(bits/8));
  if(durationSeconds>MAX_SECONDS||durationSeconds<0.25)throw Error('Длина записи должна быть от 0,25 до 120 секунд.');
  const who=await guest(req);await quota(who.key,'speech-transcription',8);await quota('global','speech-transcription',40);
  const result=await routerTranscribe(audio,durationSeconds);
  return privateResponse({text:result.text},200,who.cookie);
 }catch(e){
  const message=e instanceof z.ZodError?'Проверьте аудиозапись и попробуйте ещё раз.':e instanceof Error?e.message:'Распознавание временно недоступно.';
  return privateResponse({error:message},400);
 }
}
