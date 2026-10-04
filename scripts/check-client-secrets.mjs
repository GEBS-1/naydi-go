import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import path from 'node:path';
const secrets=['.env','.env.local','.env.buyer','.env.yookassa.test'].filter(existsSync).flatMap(file=>readFileSync(file,'utf8').split(/\r?\n/).filter(line=>/^[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|SECRET_KEY|PASSWORD)=/.test(line)&&!line.startsWith('NEXT_PUBLIC_')).map(line=>line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'')).filter(value=>value.length>12));
const root='dist/client';if(!existsSync(root))throw Error('Build the client first');
const leaks=[];let count=0;
function scan(dir){for(const name of readdirSync(dir)){const file=path.join(dir,name);if(statSync(file).isDirectory()){scan(file);continue;}if(!/\.(?:js|html|json|map)$/.test(name))continue;count++;const text=readFileSync(file,'utf8');if(secrets.some(secret=>text.includes(secret)))leaks.push(file);}}
scan(root);if(leaks.length){console.error('FAIL: known server secret found in client artifact:',leaks);process.exitCode=1;}else console.log(`PASS: ${count} client artifacts checked for ${secrets.length} configured server secrets; no values printed. This is not a full security audit.`);
