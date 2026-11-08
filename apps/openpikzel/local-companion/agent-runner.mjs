import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execute,providerName,taskPrompt} from './core.mjs';
import {findPending} from './hitl.mjs';
export async function runAgent({engine,bridge,plans,runner,provider,task,brief,model,effort,agent='default',origin,signal,scheduled=false}){
 providerName(provider);const gate=plans.gate(provider,model);if(!gate.allowed)return {paused:true,reason:'plan_limit',retryAt:gate.retryAt};
 const status=await runner.inspect(provider);if(!status.authenticated)throw new Error('Sign in using the official '+provider+' CLI first.');
 const state=await engine.read(agent);if(findPending(state.messages))return {paused:true,reason:'awaiting_user'};
 const catalog=plans.view(provider).models;
 if(model&&!catalog.some(m=>m.id===model))throw new Error('Refresh the model list and choose an available model.');
 if(effort&&(!model||!catalog.find(m=>m.id===model)?.efforts.includes(effort)))throw new Error('Choose a reasoning effort supported by this model.');
 const prompt=taskPrompt(task,brief).replace('Return useful text only. Do not call tools, inspect files, claim to see an image, invent evidence, or predict CTR.','Use only explicitly connected MCP tools when needed. Do not inspect local files, invent evidence or predict CTR.')+'\n\n'+await engine.context(agent);
 await engine.append(agent,{role:'user',content:brief,at:Date.now(),task});
 const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)controller.abort();
 const cwd=await mkdtemp(join(tmpdir(),'openpikzels-agent-'));let pending=false;
 const session=await bridge.open(agent,provider,origin,()=>{pending=true;controller.abort();},controller.signal);
 try{
  const env={};let args;
  if(provider==='claude'){
   const config={mcpServers:Object.fromEntries(session.servers.map(s=>[s.name,{type:'http',url:s.url,headers:{Authorization:'Bearer '+s.capability}}]))},file=join(cwd,'mcp.json');
   await writeFile(file,JSON.stringify(config),{mode:0o600,flag:'wx'});
   args=['-p','--settings','{"disableAllHooks":true}','--setting-sources','','--output-format','json','--tools','','--strict-mcp-config','--mcp-config',file,'--no-session-persistence','--allowedTools',session.servers.map(s=>'mcp__'+s.name).join(',')];
   if(model)args.push('--model',model);if(effort)args.push('--effort',effort);
  }else{
   env.OPENPIKZELS_BRIDGE_TOKEN=session.servers[0].capability;
   args=['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--json','-c','features.shell_tool=false','-c','features.apps=false','-c','features.hooks=false','-c','features.multi_agent=false','-c','features.remote_plugin=false','-c','web_search="disabled"'];
   for(const s of session.servers)args.push('-c','mcp_servers.'+s.name+'.url='+JSON.stringify(s.url),'-c','mcp_servers.'+s.name+'.bearer_token_env_var="OPENPIKZELS_BRIDGE_TOKEN"');
   if(model)args.push('--model',model);if(effort)args.push('-c','model_reasoning_effort='+JSON.stringify(effort));args.push('-');
  }
  let result;
  try{result=await execute(provider,args,prompt,{signal:controller.signal,cwd,env});}catch(e){if(pending||findPending((await engine.read(agent)).messages))return {paused:true,reason:'awaiting_user',omittedSse:session.omittedSse};throw e;}
  if(result.code!==0){
   if(model){let refused=false;for(const line of result.stdout.split('\n'))try{const e=JSON.parse(line);if(['model_not_found','model_not_supported','unsupported_model'].includes(e.error?.code||e.code))refused=true;}catch{}if(refused)plans.refuse(provider,model,{actualRun:true});}
   throw new Error('The official CLI did not finish. Check its version, sign-in and plan limits before retrying.');
  }
  let text='';if(provider==='claude'){try{const v=JSON.parse(result.stdout);if(!v.is_error)text=v.result||'';}catch{}}
  else for(const line of result.stdout.split('\n'))try{const e=JSON.parse(line);if(e.type==='item.completed'&&e.item?.type==='agent_message')text=e.item.text;}catch{}
  if(findPending((await engine.read(agent)).messages))return {paused:true,reason:'awaiting_user'};
  if(!text.trim())throw new Error('The CLI returned no supported text response. Update the official CLI.');
  text=await engine.redact(agent,text);await engine.append(agent,{role:'assistant',content:text,at:Date.now()});return {text,omittedSse:session.omittedSse};
 }finally{session.close();signal?.removeEventListener('abort',cancel);await rm(cwd,{recursive:true,force:true});}
}
