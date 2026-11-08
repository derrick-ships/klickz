import {spawn} from 'node:child_process';
import {cliEnvironment} from './core.mjs';
import {codexWindows,claudeWindows} from './plan-state.mjs';
export function codexDiscovery({command='codex',timeout=12000,spawnProcess=spawn}={}){
 return new Promise(resolve=>{
  const child=spawnProcess(command,['app-server'],{shell:false,env:cliEnvironment(),stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32'});
  let buffer='',bytes=0,done=false,limits,models=[],modelComplete=false,id=2;const requests=new Map();
  const stop=()=>{if(done)return;done=true;clearTimeout(timer);try{if(child.pid&&process.platform!=='win32')process.kill(-child.pid,'SIGTERM');else child.kill();}catch{}const killer=setTimeout(()=>{try{if(child.pid&&process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}},1000);killer.unref();resolve({windows:codexWindows(limits),models:modelComplete?models:undefined});};
  const send=(method,params,requestId)=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,...(params?{params}:{}),...(requestId?{id:requestId}:{})})+'\n');
  const ask=(kind,method,params)=>{const n=id++;requests.set(n,kind);send(method,params,n);};
  const timer=setTimeout(stop,timeout);timer.unref();child.on('error',stop);child.on('close',stop);child.stderr.resume();child.stdin.on('error',stop);
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>4*1024*1024)return stop();buffer+=chunk.toString();let newline;
   while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);let msg;try{msg=JSON.parse(line);}catch{continue;}
    if(msg.id===1){if(msg.error)return stop();send('initialized');ask('limits','account/rateLimits/read',{});ask('models','model/list',{limit:100,includeHidden:false});continue;}
    const kind=requests.get(msg.id);if(!kind)continue;requests.delete(msg.id);
    if(kind==='limits'&&!msg.error)limits=msg.result;
    if(kind==='models'&&!msg.error){for(const m of Array.isArray(msg.result?.data)?msg.result.data:[])if(m&&typeof m.id==='string')models.push({id:m.id,name:m.displayName||m.id,efforts:(Array.isArray(m.supportedReasoningEfforts)?m.supportedReasoningEfforts:[]).map(x=>x?.reasoningEffort).filter(x=>typeof x==='string')});
     if(msg.result?.nextCursor&&models.length<1000)ask('models','model/list',{cursor:msg.result.nextCursor,limit:100,includeHidden:false});else modelComplete=true;
    }
    if(!requests.size)stop();
   }
  });
  send('initialize',{clientInfo:{name:'openpikzels',title:'OpenPikzels local companion',version:'2.0.0'},capabilities:{experimentalApi:true}},1);
 });
}
export function parseClaudeUsage(output){
 const reports=[];for(const line of output.split('\n')){try{reports.push(JSON.parse(line));}catch{}}
 const find=v=>{if(!v||typeof v!=='object')return null;if(v.usage_report)return v.usage_report;for(const key of ['message','result']){const found=find(v[key]);if(found)return found;}return null;};
 const report=reports.map(find).find(Boolean);return claudeWindows(report);
}
// Experimental structured /usage only: older CLIs return unavailable, never scraped text.
export async function claudeDiscovery({sdk,executable,signal}={}){
 if(!sdk)return {windows:[],models:undefined,unavailable:'Structured usage is unavailable in this CLI version.'};
 let session;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);timer.unref();try{
  session=sdk.query({prompt:'/usage',options:{pathToClaudeCodeExecutable:executable,abortController:controller,env:cliEnvironment(),spawnClaudeCodeProcess:o=>spawn(o.command,o.args,{cwd:o.cwd,env:cliEnvironment(o.env),signal:o.signal,stdio:['pipe','pipe','pipe'],shell:false}),tools:[],mcpServers:{},settingSources:[],settings:{disableAllHooks:true},persistSession:false,maxTurns:1,canUseTool:async()=>({behavior:'deny',message:'Discovery does not execute tools.'})}});
  const models=await session.supportedModels();let windows=[];
  for await(const message of session){const report=message.usage_report||message.message?.usage_report;if(report)windows=claudeWindows(report);}
  return {windows,models:(Array.isArray(models)?models:[]).map(m=>({id:m.value||m.id,name:m.displayName||m.value,efforts:[]}))};
 }catch{return {windows:[],models:undefined};}finally{clearTimeout(timer);controller.abort();session?.close?.();}
}
