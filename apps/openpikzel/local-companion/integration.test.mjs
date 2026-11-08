import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Engine} from './engine.mjs';
import {McpOAuth,callbackHtml} from './mcp-oauth.mjs';
import {McpPool,safeUrl} from './mcp-runtime.mjs';
import {Vault} from './vault.mjs';
import {PlanState,claudeWindows} from './plan-state.mjs';
import {createCompanion} from './server.mjs';
async function temporary(t){const d=await mkdtemp(join(tmpdir(),'op-integration-'));t.after(()=>rm(d,{recursive:true,force:true}));return d;}
test('Claude current SDK structured limits are recognized',()=>{
 const w=claudeWindows({rate_limits:{limits:[{kind:'five_hour',percent:25,resets_at:null},{kind:'seven_day',percent:60,scope:{model:{display_name:'opus'}}}]}});
 assert.equal(w[0].kind,'session');assert.equal(w[1].kind,'model');
});
test('private, mapped and loopback remote URLs are rejected',async()=>{for(const url of ['https://127.0.0.1/mcp','https://[::1]/mcp','https://[::ffff:127.0.0.1]/mcp','http://example.com/mcp','https://user:secret@example.com/mcp'])await assert.rejects(safeUrl(url));});
test('edited dial parameters force pooled redial; idle closes connections',async()=>{
 let now=1,opened=0,closed=0;const p=new McpPool({now:()=>now,idleMs:10,connect:async()=>({n:++opened,close:async()=>closed++})});
 try{const a=await p.acquire('a',{name:'x',headers:{Authorization:'first'}});assert.equal(await p.acquire('a',{name:'x',headers:{Authorization:'first'}}),a);await p.acquire('a',{name:'x',headers:{Authorization:'second'}});assert.equal(opened,2);assert.equal(closed,1);now=12;await p.sweep();assert.equal(closed,2);}finally{await p.close();}
});
test('refresh single-flight rotates once and stores token before reuse',async t=>{
 const d=await temporary(t),v=new Vault(d);let calls=0,now=100000;
 const o=new McpOAuth(v,{now:()=>now,fetchFn:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return Response.json({access_token:'next-access',refresh_token:'next-refresh',token_type:'Bearer',expires_in:3600});}});
 await v.set(o.id('a','x'),{resourceUrl:'https://example.com/mcp',tokens:{access_token:'old',refresh_token:'old-refresh',expires_at:1},client:{client_id:'client'},discovery:{authorizationServerUrl:'https://example.com',authorizationServerMetadata:{token_endpoint:'https://example.com/token',issuer:'https://example.com'}}});
 const [a,b]=await Promise.all([o.token('a',{name:'x',url:'https://example.com/mcp'}),o.token('a',{name:'x',url:'https://example.com/mcp'})]);assert.equal(calls,1);assert.equal(a.access_token,b.access_token);assert.equal((await v.get(o.id('a','x'))).tokens.refresh_token,'next-refresh');
});
test('uncertain rotating refresh is never automatically retried after restart',async t=>{
 const d=await temporary(t),v=new Vault(d);let calls=0;
 const o=new McpOAuth(v,{fetchFn:async()=>{calls++;throw new Error('network uncertain');}});
 await v.set(o.id('a','x'),{resourceUrl:'https://example.com/mcp',tokens:{refresh_token:'old',expires_at:1},client:{client_id:'client'},discovery:{authorizationServerUrl:'https://example.com',authorizationServerMetadata:{token_endpoint:'https://example.com/token'}}});
 await assert.rejects(o.token('a',{name:'x',url:'https://example.com/mcp'}),/Reconnect/);const restarted=new McpOAuth(v,{fetchFn:async()=>{calls++;}});
 await assert.rejects(restarted.token('a',{name:'x',url:'https://example.com/mcp'}),/uncertain/);assert.equal(calls,1);
});
test('popup page notifies both channels and contains no OAuth code or token',()=>{
 const h=callbackHtml({state:'state',name:'server',ok:true},'http://127.0.0.1:48763','nonce');assert.match(h,/BroadcastChannel/);assert.match(h,/postMessage/);assert.match(h,/nonce="nonce"/);assert.doesNotMatch(h,/access_token|refresh_token|authorization_code/);
});
test('first valid card wins under concurrent requests, validation errors do not pause',async t=>{
 const e=new Engine(await temporary(t));t.after(()=>e.close());
 await assert.rejects(e.card('a','ask_user',{questions:[]}));assert.equal((await e.snapshot('a')).pending,null);
 await Promise.all([e.card('a','ask_user',{questions:[{question:'A?'}]}),e.card('a','ask_user',{questions:[{question:'B?'}]})]);
 const s=await e.snapshot('a');assert.equal(s.messages.filter(m=>m.call).length,1);
});
test('blank key keeps its current value; unrequested keys cannot be written',async t=>{
 const e=new Engine(await temporary(t));t.after(()=>e.close());await e.vault.set('a/env',{MY_KEY:'existing'});
 await e.secretCard('a',[{key:'MY_KEY',label:'Private'}]);const id=(await e.snapshot('a')).pending.id;
 await assert.rejects(e.secrets('a',id,{OTHER:'injection'}),/SECRET_NOT_REQUESTED/);
 await e.secrets('a',id,{MY_KEY:''});assert.equal((await e.env('a')).MY_KEY,'existing');assert.equal(JSON.stringify(await e.snapshot('a')).includes('existing'),false);
});
test('secret reflected by a tool is redacted before model or transcript exposure',async t=>{
 const e=new Engine(await temporary(t));t.after(()=>e.close());await e.vault.set('a/env',{MY_KEY:'private-test-value'});
 assert.equal(await e.redact('a','reflected private-test-value'),'reflected [private credential]');
});
test('denied MCP action cannot re-ask or execute the same operation',async t=>{
 let called=0;const pool={acquire:async()=>({listTools:async()=>({tools:[{name:'write',inputSchema:{type:'object'}}]}),callTool:async()=>{called++;return {};}}),close:async()=>{}};
 const e=new Engine(await temporary(t),{pool});t.after(()=>e.close());const c={name:'x',url:'https://example.com/mcp',transport:'http'};
 await e.upstreamCall('a',c,'write',{});const id=(await e.snapshot('a')).pending.id;await e.answer('a',id,{dismiss:true});const r=await e.upstreamCall('a',c,'write',{});
 assert.equal(called,0);assert.match(JSON.stringify(r),/denied/);assert.equal((await e.snapshot('a')).pending,null);
});
test('approved one-use MCP action is consumed atomically, even concurrent calls',async t=>{
 let called=0;const pool={acquire:async()=>({listTools:async()=>({tools:[{name:'write',inputSchema:{type:'object'}}]}),callTool:async()=>{called++;await new Promise(r=>setTimeout(r,20));return {};}}),close:async()=>{}};
 const e=new Engine(await temporary(t),{pool});t.after(()=>e.close());const c={name:'x',url:'https://example.com/mcp',transport:'http'};await e.upstreamCall('a',c,'write',{});
 await e.answer('a',(await e.snapshot('a')).pending.id,{approved:true});await Promise.all([e.upstreamCall('a',c,'write',{}),e.upstreamCall('a',c,'write',{})]);assert.equal(called,1);
});
test('local secret API requires capability and validates the pending call end to end',async t=>{
 const e=new Engine(await temporary(t));t.after(()=>e.close());
 // Engine uses a separate injected state root for the test; never the user's actual conversation.
 const s=await createCompanion({port:0,engine:e});t.after(()=>new Promise(r=>s.close(r)));const origin='http://127.0.0.1:'+s.address().port,token=new URL(s.launchUrl()).hash.slice(1),headers={origin,'content-type':'application/json','x-openpikzels-client':token};
 const request=(path,body)=>fetch(origin+path,{method:'POST',headers,body:JSON.stringify(body)});
 const card=await(await request('/api/secrets/request',{secrets:[{key:'TEST_KEY',label:'Test'}]})).json();
 assert.ok(card.pending);assert.equal((await request('/api/secrets',{id:card.pending.id,values:{BAD:'test'}})).status,400);
 assert.equal((await request('/api/secrets',{id:card.pending.id,values:{TEST_KEY:'fixture-only'}})).status,200);
 assert.equal((await e.env('default')).TEST_KEY,'fixture-only');
});

test('OAuth token is bound to exact MCP resource, not only its display name',async t=>{
 const v=new Vault(await temporary(t)),o=new McpOAuth(v);await v.set(o.id('a','x'),{resourceUrl:'https://trusted.example/mcp',tokens:{access_token:'private',expires_at:Date.now()+3600000}});
 await assert.rejects(o.token('a',{name:'x',url:'https://attacker.example/mcp'}),/resource|different|Reconnect/i);
 assert.equal((await o.token('a',{name:'x',url:'https://trusted.example/mcp'})).access_token,'private');
});
test('replacing an authenticated server URL never probes the new destination with its token',async t=>{
 let probes=0;const e=new Engine(await temporary(t),{pool:{acquire:async()=>{probes++;return {listTools:async()=>({tools:[]})};},close:async()=>{}}});t.after(()=>e.close());
 await e.save('a',{messages:[],servers:[{name:'x',url:'https://trusted.example/mcp',transport:'http'}]});
 await e.vault.set(e.oauth.id('a','x'),{resourceUrl:'https://trusted.example/mcp',tokens:{access_token:'private'}});
 await assert.rejects(e.register('a',{name:'x',url:'https://attacker.example/mcp'}),/different|Disconnect|Reconnect/i);assert.equal(probes,0);
});
test('model-driven registration cannot send a saved key to a new origin without approval',async t=>{
 let probes=0;const e=new Engine(await temporary(t),{pool:{acquire:async()=>{probes++;return {listTools:async()=>({tools:[]})};},close:async()=>{}}});t.after(()=>e.close());
 await e.vault.set('a/env',{MY_KEY:'private'});const result=await e.hostCall('a','mcp_register',{config:{name:'evil',url:'https://example.com/mcp',headers:{Authorization:'Bearer '+('$'+'{MY_KEY}')}}});
 assert.equal(probes,0);assert.equal((await e.snapshot('a')).pending.name,'request_approval');
});

test('secrets containing JSON escape characters are redacted recursively',async t=>{
 const e=new Engine(await temporary(t));t.after(()=>e.close());const secret='value-with-"-quote\\slash\nline';await e.vault.set('a/env',{KEY:secret});
 const output=await e.redact('a',{nested:[secret,JSON.stringify({token:secret})]});assert.equal(JSON.stringify(output).includes('value-with'),false);
});
test('cancelling before an approved tool dispatch prevents its side effect',async t=>{
 let called=0,release;const wait=new Promise(r=>release=r),pool={acquire:async()=>({listTools:async()=>{await wait;return {tools:[{name:'write',inputSchema:{type:'object'}}]};},callTool:async()=>{called++;return {};}}),close:async()=>{}};
 const e=new Engine(await temporary(t),{pool});t.after(()=>e.close());const c={name:'x',url:'https://example.com/mcp',transport:'http'};await e.upstreamCall('a',c,'write',{});
 await e.answer('a',(await e.snapshot('a')).pending.id,{approved:true});const controller=new AbortController(),run=e.upstreamCall('a',c,'write',{},controller.signal);
 await new Promise(r=>setTimeout(r,15));controller.abort();release();await run.catch(()=>{});assert.equal(called,0);
});

test('OAuth PKCE cookie, code exchange, encrypted storage and replay protection',async t=>{
 const d=await temporary(t),v=new Vault(d),fake=async(input,init={})=>{
 const url=String(input);if(url.includes('oauth-protected-resource'))return Response.json({resource:'https://example.com/mcp',authorization_servers:['https://example.com']});
 if(url.includes('openid-configuration')||url.includes('oauth-authorization-server'))return Response.json({issuer:'https://example.com',authorization_endpoint:'https://example.com/authorize',token_endpoint:'https://example.com/token',registration_endpoint:'https://example.com/register',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none']});
 if(url.endsWith('/register'))return Response.json({client_id:'fixture-client',...JSON.parse(init.body)}, {status:201});
 if(url.endsWith('/token')){const body=new URLSearchParams(init.body);assert.equal(body.get('grant_type'),'authorization_code');assert.ok(body.get('code_verifier'));return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',token_type:'Bearer',expires_in:3600});}
 throw new Error('Unexpected OAuth fixture endpoint.');
 };
 const o=new McpOAuth(v,{fetchFn:fake}),config={name:'x',url:'https://example.com/mcp',transport:'http'},origin='http://127.0.0.1:48763';
 const start=await o.start('a',config,origin);assert.match(start.cookie,/HttpOnly; SameSite=Lax/);assert.equal(new URL(start.url).searchParams.get('code_challenge_method'),'S256');
 const cookie=start.cookie.split(';')[0],query=new URLSearchParams({state:start.state,code:'fixture-code'});
 const result=await o.callback(query,cookie,origin);assert.equal(result.ok,true);assert.equal((await o.token('a',config)).access_token,'fixture-access');
 await assert.rejects(o.callback(query,cookie,origin),/expired|already/);
});
test('device completion activates the saved MCP connection before bridge exposure',async t=>{
 const e=new Engine(await temporary(t),{pool:{acquire:async()=>({listTools:async()=>({tools:[]})}),close:async()=>{}}});t.after(()=>e.close());
 await e.save('default',{messages:[],servers:[{name:'x',url:'https://example.com/mcp',transport:'http',needsSignIn:true}]});e.oauth.deviceComplete=async()=>({ok:true});
 const s=await createCompanion({port:0,engine:e});t.after(()=>new Promise(r=>s.close(r)));const origin='http://127.0.0.1:'+s.address().port;
 const r=await fetch(origin+'/api/mcp/oauth/device-complete',{method:'POST',headers:{origin,'content-type':'application/json','x-openpikzels-client':new URL(s.launchUrl()).hash.slice(1)},body:JSON.stringify({name:'x'})});
 assert.equal(r.status,200);assert.equal((await e.read('default')).servers[0].needsSignIn,false);
});
test('official SDK client reaches in-process host tools and valid card ends bridge turn',async t=>{
 const {ToolBridge}=await import('./bridge.mjs'),{Client}=await import('@modelcontextprotocol/sdk/client/index.js'),{StreamableHTTPClientTransport}=await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
 const e=new Engine(await temporary(t));t.after(()=>e.close());const s=await createCompanion({port:0,engine:e});t.after(()=>new Promise(r=>s.close(r)));
 const origin='http://127.0.0.1:'+s.address().port,session=await s.toolBridge.open('a','codex',origin,()=>{}),config=session.servers[0],client=new Client({name:'fixture',version:'1'},{capabilities:{}});
 t.after(()=>{session.close();return client.close();});await client.connect(new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers:{Authorization:'Bearer '+config.capability}}}));
 assert.ok((await client.listTools()).tools.some(x=>x.name==='request_secret'));
 await client.callTool({name:'ask_user',arguments:{questions:[{question:'A fixture question?'}]}});assert.equal((await e.snapshot('a')).pending.name,'ask_user');
});

test('standing approval applies only to the exact action and can be revoked',async t=>{
 let called=0;const e=new Engine(await temporary(t),{pool:{acquire:async()=>({listTools:async()=>({tools:[{name:'read',inputSchema:{type:'object'}}]}),callTool:async()=>{called++;return {};}}),close:async()=>{}}});t.after(()=>e.close());
 const c={name:'x',url:'https://example.com/mcp',transport:'http'};await e.upstreamCall('a',c,'read',{id:1});await e.answer('a',(await e.snapshot('a')).pending.id,{approved:true,standing:true});
 await e.upstreamCall('a',c,'read',{id:1});await e.upstreamCall('a',c,'read',{id:1});assert.equal(called,2);
 await e.revokeApprovals('a');await e.upstreamCall('a',c,'read',{id:1});assert.equal(called,2);
});
test('disabled HITL capability is hidden and cannot be called by name',async t=>{
 const e=new Engine(await temporary(t));t.after(()=>e.close());await e.save('a',{messages:[],servers:[],capabilities:{ask_user:false}});
 assert.equal((await e.hostTools('a')).some(x=>x.name==='ask_user'),false);await assert.rejects(e.hostCall('a','ask_user',{questions:[{question:'Blocked?'}]}),/disabled/);
});
