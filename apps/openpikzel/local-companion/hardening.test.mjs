import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cliEnvironment} from './core.mjs';
const plans=await import('./plan-state.mjs').catch(()=>({}));
const hitl=await import('./hitl.mjs').catch(()=>({}));
const secrets=await import('./vault.mjs').catch(()=>({}));
const mcp=await import('./mcp-runtime.mjs').catch(()=>({}));
test('child environment excludes ambient API credentials',()=>{
 const e=cliEnvironment({HOME:'/tmp/a',PATH:'/bin',LANG:'en_US',OPENAI_API_KEY:'private',ENGINE_KEY:'private',NODE_OPTIONS:'--require bad'},'/tmp/a');
 assert.equal(e.OPENAI_API_KEY,undefined);assert.equal(e.ENGINE_KEY,undefined);assert.equal(e.NODE_OPTIONS,undefined);assert.equal(e.LANG,'en_US');
});
test('Codex classifies windows by duration, never slot position',()=>{
 assert.equal(typeof plans.codexWindows,'function');
 const w=plans.codexWindows({rateLimits:{primary:{usedPercent:90,windowDurationMins:10080,resetsAt:2000000000},secondary:{usedPercent:30,windowDurationMins:300}}});
 assert.deepEqual(w.map(x=>x.kind),['weekly','session']);assert.deepEqual(plans.codexWindows({moved:{}}),[]);
 assert.deepEqual(plans.codexWindows({rateLimits:{primary:{usedPercent:'100'}}}),[]);
});
test('Claude tolerates optional and model scoped windows',()=>{
 assert.equal(typeof plans.claudeWindows,'function');
 const w=plans.claudeWindows({rate_limits:{five_hour:{utilization:12},seven_day:{utilization:null},model_scoped:{opus:{utilization:42}}}});
 assert.equal(w.length,2);assert.equal(w[1].kind,'model');assert.equal(w[1].model,'opus');
});
test('latch survives missing readings until reset or thirty minutes',()=>{
 assert.equal(typeof plans.PlanState,'function');let now=1000;const s=new plans.PlanState(()=>now);
 s.record('codex',[{kind:'session',usedPercent:100,resetsAt:5000}],[]);now=2000;s.record('codex',[],undefined);
 assert.equal(s.gate('codex').allowed,false);now=5000;assert.equal(s.gate('codex').allowed,true);
 s.record('codex',[{kind:'session',usedPercent:100}],[]);now+=1800000;assert.equal(s.gate('codex').allowed,true);
});
test('actual listed model refusals hide six hours; failed probes never hide',()=>{
 assert.equal(typeof plans.PlanState,'function');let now=1;const s=new plans.PlanState(()=>now);
 s.record('codex',[],[{id:'a'},{id:'b'}]);s.refuse('codex','a',{actualRun:false});assert.equal(s.view('codex').models.length,2);
 s.refuse('codex','a',{actualRun:true});assert.deepEqual(s.view('codex').models.map(x=>x.id),['b']);now+=21600001;assert.equal(s.view('codex').models.length,2);
});
test('HITL accepts JSON-string arrays and null optionals',()=>{
 assert.equal(typeof hitl.validateCall,'function');assert.equal(hitl.validateCall('ask_user',{questions:'[{"question":"Choose?","options":null}]'}).questions.length,1);
 assert.equal(hitl.findPending([{role:'assistant',call:{id:'x',name:'ask_user',input:{questions:[]}}},{role:'tool',callId:'x',isError:true}]),null);
});
test('pending HITL and answers derive from transcript',()=>{
 assert.equal(typeof hitl.findPending,'function');const messages=[{role:'assistant',call:{id:'x',name:'ask_user',input:{questions:[{question:'A?'}]}}},{role:'tool',callId:'x',content:{status:'delivered'}}];
 assert.equal(hitl.findPending(messages).id,'x');messages.push(hitl.answerMessage(messages,'x',{answers:[{question:'A?',answer:'Yes'}]}));
 assert.equal(hitl.findPending(messages),null);assert.deepEqual(hitl.parseReply(messages.at(-1).content).answers,[{question:'A?',answer:'Yes'}]);
});
test('unrequested secrets rejected, transcript holds statuses only',async()=>{
 assert.equal(typeof hitl.submitSecrets,'function');const written=[];const messages=[{role:'assistant',call:{id:'s',name:'request_secret',input:{secrets:[{key:'MY_KEY',label:'Key'}]}}}];
 await assert.rejects(hitl.submitSecrets(messages,'s',{OTHER:'bad'},{set:async(...v)=>written.push(v)}),/SECRET_NOT_REQUESTED/);
 await hitl.submitSecrets(messages,'s',{MY_KEY:'supersecret'},{set:async(...v)=>written.push(v)});
 assert.equal(written[0][1],'supersecret');assert.equal(JSON.stringify(messages).includes('supersecret'),false);assert.equal(hitl.findPending(messages),null);
});
test('vault encrypted and isolated by key',async()=>{
 assert.equal(typeof secrets.Vault,'function');const dir=await mkdtemp(join(tmpdir(),'op-vault-test-'));
 try{const v=new secrets.Vault(dir);await v.set('a/token',{access_token:'private-value'});assert.deepEqual(await v.get('a/token'),{access_token:'private-value'});
 assert.equal((await readFile(join(dir,'vault.json'),'utf8')).includes('private-value'),false);assert.equal(await v.get('b/token'),null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('MCP placeholders use only agent env; OAuth and identity remain literal',async()=>{
 assert.equal(typeof mcp.prepareServer,'function');const ref='$'+'{MY_KEY}';
 const r=await mcp.prepareServer({name:'x',url:'https://example.com/mcp',headers:{'x-key':ref}},{agentEnv:{MY_KEY:'own'},identity:{'x-agent':ref},oauth:{access_token:'literal-'+ref}});
 assert.equal(r.transport,'http');assert.equal(r.headers['x-key'],'own');assert.equal(r.headers['x-agent'],ref);assert.equal(r.headers.Authorization,'Bearer literal-'+ref);
 await assert.rejects(mcp.prepareServer({name:'x',url:'https://example.com/'+('$'+'{ENGINE_KEY}')},{agentEnv:{}}),/Missing agent secret/);
});
test('transport detection and Codex SSE exclusion',()=>{
 assert.equal(typeof mcp.transportKind,'function');assert.equal(mcp.transportKind({command:'node'}),'stdio');assert.equal(mcp.transportKind({url:'https://example.com/sse'}),'sse');
 assert.equal(mcp.cliServers('codex',[{name:'events',transport:'sse',url:'https://example.com/sse'}]).length,0);
});
test('probe before save distinguishes missing vs rejected credentials',async()=>{
 assert.equal(typeof mcp.registerServer,'function');const saved=[];const probe=async()=>{const e=new Error('unauthorized');e.status=401;throw e;};
 assert.equal((await mcp.registerServer({name:'a',url:'https://example.com/mcp'},{probe,save:async v=>saved.push(v)})).needsSignIn,true);
 await assert.rejects(mcp.registerServer({name:'b',url:'https://example.com/mcp',headers:{Authorization:'Bearer bad'}},{probe,save:async v=>saved.push(v)}),/request_secret/);assert.equal(saved.length,1);
});
test('root schema unions expose ordinary properties',()=>{
 assert.equal(typeof mcp.normalizeSchema,'function');const s=mcp.normalizeSchema({oneOf:[{type:'object',properties:{a:{type:'string'}},required:['a']},{type:'object',properties:{b:{type:'number'}}}]});
 assert.equal(s.type,'object');assert.ok(s.properties.a);assert.ok(s.properties.b);assert.equal(s.oneOf,undefined);
});

test('moved or null provider buckets never throw',()=>{assert.deepEqual(plans.codexWindows({rateLimitsByLimitId:{a:null,b:[]}}),[]);assert.deepEqual(plans.claudeWindows({rate_limits:{limits:[null,{},[]]}}),[]);});

test('stored OAuth overrides an obsolete unresolved authorization placeholder',async()=>{const r=await mcp.prepareServer({name:'x',url:'https://example.com/mcp',headers:{Authorization:'Bearer '+('$'+'{OLD_KEY}')}},{oauth:{access_token:'current'}});assert.equal(r.headers.Authorization,'Bearer current');});
test('401 with stored OAuth does not save a new configuration',async()=>{let saves=0;await assert.rejects(mcp.registerServer({name:'x',url:'https://example.com/mcp'},{hasCredential:true,probe:async()=>{const e=new Error();e.status=401;throw e;},save:async()=>saves++}),/request_secret/);assert.equal(saves,0);});
