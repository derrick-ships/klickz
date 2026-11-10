import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Engine,accountServerName} from './engine.mjs';
import {McpOAuth} from './mcp-oauth.mjs';
import {McpPool} from './mcp-runtime.mjs';
import {Vault} from './vault.mjs';

const fixtureAccess='opz-test-access-0000FAKE';
const fixtureRefresh='opz-test-refresh-0000FAKE';
const fixtureMcp='https://1.1.1.1/mcp';

function toolText(result){
 return (result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
}
function toolNames(tools){
 return tools.map(tool=>tool.name);
}
function fixtureMemoryServer(){
 const calls=[];
 return {
  calls,
  connect:async config=>({
   listTools:async()=>({tools:[
    {name:'remember_fact',inputSchema:{type:'object',properties:{fact:{type:'string'}},required:['fact']}},
    {name:'recall_facts',inputSchema:{type:'object',properties:{query:{type:'string'}}}},
    {name:'forget_fact',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}}
   ]}),
   callTool:async({name,arguments:args})=>{
    calls.push({name,args,authorization:config.headers?.Authorization});
    if(name==='remember_fact'){
     const row={id:'11111111-1111-4111-8111-111111111111',fact:args.fact,tags:args.tags||[],created_at:'2026-11-10T00:00:00Z',echo:config.headers?.Authorization||''};
     return {content:[{type:'text',text:JSON.stringify(row)}]};
    }
    if(name==='recall_facts'){
     return {content:[{type:'text',text:JSON.stringify({facts:[{id:'11111111-1111-4111-8111-111111111111',fact:'Preferred thumbnail style is high contrast',tags:['style'],created_at:'2026-11-10T00:00:00Z'}]})}]};
    }
    throw new Error('Unexpected fixture tool '+name);
   },
   close:async()=>{}
  })
 };
}
async function memoryEngine(t,{linked=false,capabilities={},server=fixtureMemoryServer()}={}){
 const previous=process.env.OPENPIKZELS_MCP_URL;
 process.env.OPENPIKZELS_MCP_URL=fixtureMcp;
 t.after(()=>{if(previous===undefined)delete process.env.OPENPIKZELS_MCP_URL;else process.env.OPENPIKZELS_MCP_URL=previous;});
 const directory=await mkdtemp(join(tmpdir(),'openpikzels-memory-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const vault=new Vault(join(directory,'credentials')),oauth=new McpOAuth(vault,{fetchFn:async()=>{throw new Error('Unexpected OAuth network call.');}});
 const engine=new Engine(directory,{vault,oauth,pool:new McpPool({connect:server.connect})});
 t.after(()=>engine.close());
 await engine.save('default',{messages:[],servers:[],capabilities});
 if(linked)await vault.set(oauth.id('default',accountServerName),{
  resourceUrl:fixtureMcp,
  tokens:{access_token:fixtureAccess,refresh_token:fixtureRefresh,expires_at:Date.now()+3600000},
  client:{client_id:'fixture-client'},
  discovery:{authorizationServerMetadata:{revocation_endpoint:'https://1.1.1.1/oauth/revoke'}}
 });
 return {engine,server,directory};
}

test('memory tools are listed only when the account is linked and the memory switch is on',async t=>{
 const unlinked=await memoryEngine(t);
 assert.equal(toolNames(await unlinked.engine.hostTools('default')).includes('memory_write'),false);
 assert.equal(toolNames(await unlinked.engine.hostTools('default')).includes('memory_recall'),false);
 const off=await memoryEngine(t,{linked:true,capabilities:{memory:false}});
 assert.equal(toolNames(await off.engine.hostTools('default')).includes('memory_write'),false);
 assert.equal(toolNames(await off.engine.hostTools('default')).includes('memory_recall'),false);
 await assert.rejects(off.engine.hostCall('default','memory_write',{fact:'A thumbnail style note'}),/disabled|memory/i);
 const on=await memoryEngine(t,{linked:true});
 const names=toolNames(await on.engine.hostTools('default'));
 assert.equal(names.includes('memory_write'),true);
 assert.equal(names.includes('memory_recall'),true);
 assert.equal(names.includes('forget_fact'),false);
 assert.equal(names.includes('remember_fact'),false);
});

test('unlinked memory calls return not_linked and tell the model to call suggest_service',async t=>{
 const {engine,server}=await memoryEngine(t);
 const result=await engine.hostCall('default','memory_write',{fact:'A thumbnail style note'});
 const body=JSON.parse(toolText(result));
 assert.equal(body.status,'not_linked');
 assert.match(String(body.instruction),/suggest_service/);
 assert.equal(server.calls.length,0);
 const state=await engine.snapshot('default');
 assert.equal(state.pending,null);
});

test('memory_write and memory_recall proxy to the OP-14 tools over the linked token without an approval card',async t=>{
 const {engine,server}=await memoryEngine(t,{linked:true});
 const written=await engine.hostCall('default','memory_write',{fact:'Preferred thumbnail style is high contrast',tags:['style']});
 const recalled=await engine.hostCall('default','memory_recall',{query:'thumbnail style'});
 assert.equal(server.calls.length,2);
 assert.equal(server.calls[0].name,'remember_fact');
 assert.equal(server.calls[0].args.fact,'Preferred thumbnail style is high contrast');
 assert.deepEqual(server.calls[0].args.tags,['style']);
 assert.equal(server.calls[0].authorization,'Bearer '+fixtureAccess);
 assert.equal(server.calls[1].name,'recall_facts');
 assert.equal(server.calls[1].args.query,'thumbnail style');
 assert.equal(server.calls[1].authorization,'Bearer '+fixtureAccess);
 assert.match(toolText(written),/Preferred thumbnail style is high contrast/);
 assert.match(toolText(recalled),/Preferred thumbnail style is high contrast/);
 const state=await engine.snapshot('default');
 assert.equal(state.pending,null);
 assert.equal(JSON.stringify(state.messages).includes('request_approval'),false);
});

test('memory results are redacted before they enter the transcript',async t=>{
 const {engine,server}=await memoryEngine(t,{linked:true});
 const result=await engine.hostCall('default','memory_write',{fact:'Preferred thumbnail style is high contrast'});
 assert.equal(server.calls.length,1);
 assert.equal(toolText(result).includes(fixtureAccess),false);
 assert.equal(toolText(result).includes(fixtureRefresh),false);
 assert.match(toolText(result),/\[private credential\]/);
 await engine.append('default',{role:'tool',name:'memory_write',content:result,at:Date.now()});
 const stored=JSON.stringify(await engine.read('default'));
 assert.equal(stored.includes(fixtureAccess),false);
 assert.equal(stored.includes(fixtureRefresh),false);
 assert.match(stored,/\[private credential\]/);
});
