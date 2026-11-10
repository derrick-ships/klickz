import {test} from 'node:test';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {mkdtempSync,readFileSync,rmSync,statSync,mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {makeRunner,authStatus,taskPrompt,execute} from './core.mjs';
import {createCompanion as createRealCompanion} from './server.mjs';
const createCompanion=options=>createRealCompanion({...options,readTelemetry:async()=>({windows:[],models:[],gate:{allowed:true}}),runTask:async args=>({text:await options.runner.run(args.provider,args.task,args.brief,args.signal)})});
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

import {Engine} from './engine.mjs';
import {McpOAuth} from './mcp-oauth.mjs';
import {Vault} from './vault.mjs';
const fixtureAccess='opz-test-access-0000FAKE';
const fixtureRefresh='opz-test-refresh-0000FAKE';
const fixtureMcp='https://1.1.1.1/mcp';
function oauthFixture(revokes=[],{revokeStatus=200,revokeThrow=false,revocationEndpoint=true}={}){
  return async(input,init={})=>{
    const url=String(input);
    if(url.includes('oauth-protected-resource'))return Response.json({resource:fixtureMcp,authorization_servers:['https://1.1.1.1'],scopes_supported:['studio:read','studio:agent']});
    if(url.includes('openid-configuration')||url.includes('oauth-authorization-server'))return Response.json({issuer:'https://1.1.1.1',authorization_endpoint:'https://1.1.1.1/authorize',token_endpoint:'https://1.1.1.1/token',registration_endpoint:'https://1.1.1.1/register',...(revocationEndpoint?{revocation_endpoint:'https://1.1.1.1/oauth/revoke'}:{}),response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none']});
    if(url.endsWith('/register'))return Response.json({client_id:'fixture-client',...JSON.parse(init.body)},{status:201});
    if(url.endsWith('/token')){const body=new URLSearchParams(init.body);assert.equal(body.get('grant_type'),'authorization_code');assert.ok(body.get('code_verifier'));return Response.json({access_token:fixtureAccess,refresh_token:fixtureRefresh,token_type:'Bearer',expires_in:3600,scope:'studio:read studio:agent'});}
    if(url.endsWith('/oauth/revoke')){if(revokeThrow)throw new Error('revoke fixture failed');revokes.push(String(init.body||''));return new Response(null,{status:revokeStatus});}
    throw new Error('Unexpected OAuth fixture endpoint.');
  };
}
async function captureLogs(fn){
  const lines=[];
  const orig={log:console.log,info:console.info,warn:console.warn,error:console.error};
  for(const name of Object.keys(orig))console[name]=(...args)=>lines.push(args.map(String).join(' '));
  try{return {result:await fn(),lines};}finally{Object.assign(console,orig);}
}

test('account link completes PKCE to /mcp, stores tokens only in the vault, and survives a restart',async t=>{
  const previous=process.env.OPENPIKZELS_MCP_URL;
  process.env.OPENPIKZELS_MCP_URL=fixtureMcp;
  t.after(()=>{if(previous===undefined)delete process.env.OPENPIKZELS_MCP_URL;else process.env.OPENPIKZELS_MCP_URL=previous;});
  const directory=mkdtempSync(join(tmpdir(),'openpikzels-account-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const vault=new Vault(join(directory,'credentials')),oauth=new McpOAuth(vault,{fetchFn:oauthFixture()}),engine=new Engine(directory,{vault,oauth});
  const {result,lines}=await captureLogs(async()=>{
    const server=await createCompanion({port:0,engine});
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const origin='http://127.0.0.1:'+server.address().port,token=new URL(server.launchUrl()).hash.slice(1);
    const headers={origin,'content-type':'application/json','x-openpikzels-client':token};
    const html=await(await fetch(origin)).text();
    assert.match(html,/Link my OpenPikzels account/);
    const started=await fetch(origin+'/api/account/link',{method:'POST',headers,body:'{}'});
    assert.equal(started.status,200);
    const body=await started.json();
    assert.equal(JSON.stringify(body).includes(fixtureAccess),false);
    const authorize=new URL(body.url);
    assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');
    assert.match(authorize.searchParams.get('scope')||'',/studio:agent/);
    assert.equal(authorize.searchParams.get('resource')||fixtureMcp,fixtureMcp);
    const cookie=(started.headers.get('set-cookie')||'').split(';')[0];
    const callback=await fetch(origin+'/api/mcp/oauth/callback?'+new URLSearchParams({state:body.state,code:'fixture-code'}),{headers:{cookie}});
    assert.equal(callback.status,200);
    const status=await(await fetch(origin+'/api/account/status',{method:'POST',headers,body:'{}'})).json();
    assert.equal(status.linked,true);
    assert.equal(JSON.stringify(status).includes(fixtureAccess),false);
    assert.equal(JSON.stringify(status).includes(fixtureRefresh),false);
    const stored=await vault.get(oauth.id('default','openpikzels'));
    assert.equal(stored.tokens.access_token,fixtureAccess);
    const state=JSON.stringify(await engine.read('default'));
    assert.equal(state.includes(fixtureAccess),false);
    assert.equal(state.includes(fixtureRefresh),false);
    const restarted=new Engine(directory);
    assert.equal((await restarted.accountStatus('default')).linked,true);
    return status;
  });
  assert.equal(lines.join('\n').includes(fixtureAccess),false);
  assert.equal(lines.join('\n').includes(fixtureRefresh),false);
  assert.equal(result.linked,true);
});

test('account unlink revokes the grant and deletes vault tokens',async t=>{
  const previous=process.env.OPENPIKZELS_MCP_URL;
  process.env.OPENPIKZELS_MCP_URL=fixtureMcp;
  t.after(()=>{if(previous===undefined)delete process.env.OPENPIKZELS_MCP_URL;else process.env.OPENPIKZELS_MCP_URL=previous;});
  const directory=mkdtempSync(join(tmpdir(),'openpikzels-unlink-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const revokes=[],vault=new Vault(join(directory,'credentials')),oauth=new McpOAuth(vault,{fetchFn:oauthFixture(revokes)}),engine=new Engine(directory,{vault,oauth});
  const server=await createCompanion({port:0,engine});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin='http://127.0.0.1:'+server.address().port,token=new URL(server.launchUrl()).hash.slice(1);
  const headers={origin,'content-type':'application/json','x-openpikzels-client':token};
  const started=await fetch(origin+'/api/account/link',{method:'POST',headers,body:'{}'});
  const body=await started.json();
  const cookie=(started.headers.get('set-cookie')||'').split(';')[0];
  assert.equal((await fetch(origin+'/api/mcp/oauth/callback?'+new URLSearchParams({state:body.state,code:'fixture-code'}),{headers:{cookie}})).status,200);
  const unlinked=await fetch(origin+'/api/account/unlink',{method:'POST',headers,body:'{}'});
  assert.equal(unlinked.status,200);
  assert.equal((await unlinked.json()).linked,false);
  assert.equal(revokes.length,1);
  const revoked=new URLSearchParams(revokes[0]);
  assert.equal(revoked.get('client_id'),'fixture-client');
  assert.ok(revoked.get('token')===fixtureRefresh||revoked.get('token')===fixtureAccess);
  assert.equal(await vault.get(oauth.id('default','openpikzels')),null);
  assert.equal((await(await fetch(origin+'/api/account/status',{method:'POST',headers,body:'{}'})).json()).linked,false);
});

async function accountRecord(endpoint=true){
  return {resourceUrl:fixtureMcp,tokens:{access_token:fixtureAccess,refresh_token:fixtureRefresh,expires_at:Date.now()+3600000},client:{client_id:'fixture-client'},discovery:{authorizationServerMetadata:endpoint?{revocation_endpoint:'https://1.1.1.1/oauth/revoke'}:{}}};
}
async function seededEngine(t,fetchFn,endpoint=true){
  const directory=mkdtempSync(join(tmpdir(),'openpikzels-unlink-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const vault=new Vault(join(directory,'credentials')),oauth=new McpOAuth(vault,{fetchFn}),engine=new Engine(directory,{vault,oauth});
  await vault.set(oauth.id('default','openpikzels'),await accountRecord(endpoint));
  return {vault,oauth,engine};
}
function assertUnlinkFailed(result,stored){
  assert.notEqual(result.revoked,true);
  assert.equal(result.linked,true);
  assert.ok(result.error);
  assert.equal(String(result.error).includes(fixtureAccess),false);
  assert.equal(String(result.error).includes(fixtureRefresh),false);
  assert.equal(stored?.tokens?.access_token,fixtureAccess);
  assert.equal(stored?.tokens?.refresh_token,fixtureRefresh);
}

test('unlink keeps vault tokens when the revoke request throws',async t=>{
  const {vault,oauth,engine}=await seededEngine(t,oauthFixture([],{revokeThrow:true}));
  const result=await engine.unlinkAccount('default');
  assertUnlinkFailed(result,await vault.get(oauth.id('default','openpikzels')));
});

test('unlink keeps vault tokens when revoke returns 500',async t=>{
  const {vault,oauth,engine}=await seededEngine(t,oauthFixture([],{revokeStatus:500}));
  const result=await engine.unlinkAccount('default');
  assertUnlinkFailed(result,await vault.get(oauth.id('default','openpikzels')));
});

test('unlink keeps vault tokens when metadata has no revocation_endpoint',async t=>{
  const {vault,oauth,engine}=await seededEngine(t,oauthFixture(),false);
  const result=await engine.unlinkAccount('default');
  assertUnlinkFailed(result,await vault.get(oauth.id('default','openpikzels')));
});

test('unlink clears vault tokens after a successful revoke',async t=>{
  const revokes=[],{vault,oauth,engine}=await seededEngine(t,oauthFixture(revokes));
  const result=await engine.unlinkAccount('default');
  assert.equal(result.revoked,true);
  assert.equal(result.linked,false);
  assert.equal(await vault.get(oauth.id('default','openpikzels')),null);
  assert.equal(revokes.length,1);
});
