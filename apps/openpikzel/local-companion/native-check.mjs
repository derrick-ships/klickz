import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Engine} from './engine.mjs';import {createCompanion} from './server.mjs';
const dir=await mkdtemp(join(tmpdir(),'op-native-check-')),engine=new Engine(dir),server=await createCompanion({port:0,engine});
try{const origin='http://127.0.0.1:'+server.address().port,r=await fetch(origin+'/api/run',{method:'POST',headers:{origin,'content-type':'application/json','x-openpikzels-client':new URL(server.launchUrl()).hash.slice(1)},body:JSON.stringify({provider:'codex',task:'titles',brief:'A video compares two thumbnail compositions using the same subject and truthful title. Write five title options. No tool calls are needed.'})}),v=await r.json();console.log(JSON.stringify({status:r.status,returnedText:typeof v.text==='string'&&v.text.length>0,paused:!!v.paused,...(v.error?{error:v.error}:{})}));}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));await engine.close();await rm(dir,{recursive:true,force:true});}
