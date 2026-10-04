// UI lifecycle test with a simulated browser recognizer, NOT a real audio test.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://localhost:3000',out='artifacts/dictation';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.addInitScript(()=>{localStorage.setItem('ng_city','Казань');window.SpeechRecognition=class{start(){window.testRecognition=this;window.recognitionStarts=(window.recognitionStarts||0)+1;}stop(){this.onend?.();}abort(){this.onend?.();}};});
 const requests=[];await page.route('**/api/search',r=>{requests.push(r.request().postDataJSON());return r.abort();});
 await page.goto(base);const input=page.getByRole('textbox',{name:'Что хотите найти?'});await input.waitFor();
 await page.getByRole('button',{name:'Изменить город',exact:true}).click();await page.getByLabel('Город',{exact:true}).fill('Казань');await page.getByRole('button',{name:'Выбрать',exact:true}).click();
 await input.fill('купить');await page.getByRole('button',{name:'Голосовой ввод',exact:true}).click();
 await page.evaluate(()=>window.testRecognition.onresult({results:[{isFinal:true,0:{transcript:'дрель'}}]}));
 await expect(input).toHaveValue('купить дрель');const starts=await page.evaluate(()=>window.recognitionStarts);await page.evaluate(()=>window.testRecognition.onend());await expect.poll(()=>page.evaluate(()=>window.recognitionStarts)).toBe(starts+1);await page.evaluate(()=>window.testRecognition.onresult({results:[{isFinal:true,0:{transcript:'для бетона'}}]}));await expect(input).toHaveValue('купить дрель для бетона');await page.screenshot({path:`${out}/recording-${width}.png`});
 await page.getByRole('button',{name:'Отменить диктовку',exact:true}).click();await expect(input).toHaveValue('купить');
 await page.getByRole('button',{name:'Голосовой ввод',exact:true}).click();await page.evaluate(()=>window.testRecognition.onresult({results:[{isFinal:true,0:{transcript:'дрель'}}]}));
 await page.getByRole('button',{name:'Остановить диктовку',exact:true}).click();await expect(input).toHaveValue('купить дрель');if(requests.length)throw Error('Stop must not submit');
 await input.fill('');await page.getByRole('button',{name:'Голосовой ввод',exact:true}).click();await page.evaluate(()=>window.testRecognition.onresult({results:[{isFinal:true,0:{transcript:'наушники'}}]}));
 await page.getByRole('button',{name:'Отправить сразу',exact:true}).click();await expect.poll(()=>requests.length).toBe(1);if(requests[0].query!=='наушники')throw Error('Incorrect final transcript');
 report.push({width,silenceRestart:true,cancel:true,stop:true,send:true,recognizer:'simulated',realAudioTest:false});await page.close();
}}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}console.log(report);
