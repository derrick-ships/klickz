import {test} from 'node:test';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {mkdtempSync,readFileSync,rmSync,statSync,mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {makeRunner,authStatus,taskPrompt,execute} from './core.mjs';
import {createCompanion} from './server.mjs';
test('status exposes only authentication state',()=>{
 assert.deepEqual(authStatus('claude',0,JSON.stringify({loggedIn:true,authMethod:'claude.ai',email:'private@example.com',access_token:'must-not-return'})),{installed:true,authenticated:true,method:'Claude subscription'});
 assert.equal(authStatus('codex',0,'Logged in using ChatGPT').method,'ChatGPT plan');
 assert.equal(authStatus('codex',0,'Logged in using an API key').method,'API credits');
 assert.equal(authStatus('codex',1,'unknown').authenticated,false);
});
test('unsupported providers, tasks and oversized briefs are refused',()=>{
 assert.throws(()=>taskPrompt('shell','hello'));
 assert.throws(()=>taskPrompt('titles','a'.repeat(12001)));
 assert.throws(()=>makeRunner().inspect('bash'));
});
test('the official process receives the brief on stdin, never a shell argument',async()=>{
 const calls=[];
 const runner=makeRunner({execute:async (command,args,input)=>{calls.push({command,args,input});return {code:0,stdout:args.includes('status')?JSON.stringify({loggedIn:true,authMethod:'claude.ai'}):JSON.stringify({result:'Five original titles'})};}});
 assert.equal(await runner.run('claude','titles','literal $(touch bad) <script>',new AbortController().signal),'Five original titles');
 assert.equal(calls.at(-1).command,'claude');
 assert.ok(!calls.at(-1).args.join(' ').includes('touch bad'));
 assert.ok(calls.at(-1).input.includes('literal $(touch bad)'));
 assert.ok(calls.at(-1).args.includes('--no-session-persistence'));
 const settings=calls.at(-1).args[calls.at(-1).args.indexOf('--settings')+1];
 assert.equal(JSON.parse(settings).disableAllHooks,true);
});
test('a logged-out process cannot start a plan run',async()=>{
 let calls=0;
 const runner=makeRunner({execute:async()=>{calls++;return {code:1,stdout:''};}});
 await assert.rejects(runner.run('codex','titles','Actual video',new AbortController().signal),/Sign in/);
 assert.equal(calls,1);
});
test('loopback API enforces Host, Origin and its private capability before running',async t=>{
 let runs=0;
 const server=await createCompanion({port:0,runner:{inspect:async()=>({installed:true,authenticated:true,method:'ChatGPT plan'}),run:async()=>{runs++;return '<script>literal output</script>';}}});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port;
 const html=await (await fetch(origin)).text();
 const token=new URL(server.launchUrl()).hash.slice(1);
 const body=JSON.stringify({provider:'codex',task:'titles',brief:'Video brief'});
 assert.equal((await fetch(origin+'/api/run',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json','x-openpikzels-client':token},body})).status,403);
 assert.equal((await fetch(origin+'/api/run',{method:'POST',headers:{origin,'content-type':'application/json'},body})).status,403);
 const badHost=await new Promise((resolve,reject)=>{const req=httpRequest(origin,{headers:{host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
 assert.equal(badHost,403);
 const result=await fetch(origin+'/api/run',{method:'POST',headers:{origin,'content-type':'application/json','x-openpikzels-client':token},body});
 assert.equal(result.status,200);assert.deepEqual(await result.json(),{text:'<script>literal output</script>'});assert.equal(runs,1);
 assert.ok(!result.headers.has('access-control-allow-origin'));
});
test('overlapping runs are refused and cancellation releases the active request',async t=>{
 const server=await createCompanion({port:0,runner:{run:async(_p,_t,_b,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true})),inspect:async()=>({installed:true,authenticated:true,method:'ChatGPT plan'})}});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port, html=await(await fetch(origin)).text(),token=new URL(server.launchUrl()).hash.slice(1);
 const headers={origin,'content-type':'application/json','x-openpikzels-client':token},body=JSON.stringify({provider:'codex',task:'titles',brief:'An actual title'});
 const first=fetch(origin+'/api/run',{method:'POST',headers,body});
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal((await fetch(origin+'/api/run',{method:'POST',headers,body})).status,409);
 assert.equal((await fetch(origin+'/api/cancel',{method:'POST',headers,body:'{}'})).status,200);
 assert.equal((await first).status,400);
});

test('a timed-out process exits before the runner releases its request',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'openpikzels-lifetime-')),file=join(directory,'pid');
 const code="require('node:fs').writeFileSync("+JSON.stringify(file)+",String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000)";
 let pid;
 try {
  await assert.rejects(execute(process.execPath,['-e',code],'',{timeout:150}),/timed out/);
  pid=Number(readFileSync(file,'utf8'));
  assert.throws(()=>process.kill(pid,0),/ESRCH/);
 } finally {if(pid)try{process.kill(pid,'SIGKILL');}catch{};rmSync(directory,{recursive:true,force:true});}
});

test('Codex status supports stderr without exposing its raw output',async()=>{
 const result=await execute(process.execPath,['-e',"console.error('Logged in using ChatGPT')"],'',{captureStatus:true});
 assert.deepEqual(authStatus('codex',result.code,result.stdout),{installed:true,authenticated:true,method:'ChatGPT plan'});
});

test('timeout stops same-group descendants even when the parent exits first',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'openpikzels-descendant-')),pidFile=join(directory,'pid'),heartbeat=join(directory,'heartbeat');
 const grandchild="const fs=require('node:fs');fs.writeFileSync("+JSON.stringify(pidFile)+",String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync("+JSON.stringify(heartbeat)+",'x'),20)";
 const parent="require('node:child_process').spawn(process.execPath,['-e',"+JSON.stringify(grandchild)+"],{stdio:'ignore'});setInterval(()=>{},1000)";
 let pid;
 try {
  await assert.rejects(execute(process.execPath,['-e',parent],'',{timeout:250}),/timed out/);
  pid=Number(readFileSync(pidFile,'utf8'));
  const before=statSync(heartbeat).size;
  await new Promise(resolve=>setTimeout(resolve,120));
  assert.equal(statSync(heartbeat).size,before,'descendant must not continue work after timeout resolves');
 }finally{if(pid)try{process.kill(pid,'SIGKILL');}catch{};rmSync(directory,{recursive:true,force:true});}
});
test('terminal SIGHUP closes the server and aborts its active task',async()=>{
 const {installShutdownHandlers}=await import('./server.mjs');
 let began;const started=new Promise(resolve=>began=resolve);let aborted=false;
 const server=await createCompanion({port:0,runner:{run:async(_p,_t,_b,signal)=>{began();return new Promise((_r,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('Cancelled'));},{once:true}));}}});
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin)).text(),token=new URL(server.launchUrl()).hash.slice(1);
 try {
  const events=new EventEmitter();installShutdownHandlers(server,events);
  const request=fetch(origin+'/api/run',{method:'POST',headers:{origin,'content-type':'application/json','x-openpikzels-client':token},body:JSON.stringify({provider:'codex',task:'titles',brief:'A factual video brief'})}).catch(()=>null);
  await started;
  const closed=new Promise(resolve=>server.once('close',resolve));events.emit('SIGHUP');await closed;await request;
  assert.equal(aborted,true);assert.equal(server.listening,false);
 }finally{server.close();server.closeAllConnections();}
});

test('the public local page does not disclose its process capability',async t=>{
 const server=await createCompanion({port:0,runner:{}});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const html=await(await fetch('http://127.0.0.1:'+server.address().port)).text();
 assert.ok(!/name="csrf" content="[a-f0-9]{64}"/.test(html));
});

test('standard user CLI installs work even when the launcher PATH omits them',async()=>{
 const {cliEnvironment}=await import('./core.mjs');
 const directory=mkdtempSync(join(tmpdir(),'openpikzels-path-'));
 try{const bin=join(directory,'.local','bin');mkdirSync(bin,{recursive:true});const path=join(bin,'claude');writeFileSync(path,'#!/bin/sh\nprintf fixture-cli\n');chmodSync(path,0o755);
 const result=spawnSync('claude',['--version'],{env:cliEnvironment({PATH:'/usr/bin:/bin'},directory),encoding:'utf8'});
 assert.equal(result.status,0);assert.equal(result.stdout,'fixture-cli');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
