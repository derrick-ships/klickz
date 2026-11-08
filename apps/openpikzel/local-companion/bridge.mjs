import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {findPending} from './hitl.mjs';
export class ToolBridge{
 constructor(engine){this.engine=engine;this.runs=new Map();}
 async open(agent,provider,origin,onCard,signal){
  const capability=randomBytes(32).toString('hex'),id=randomBytes(16).toString('hex'),state=await this.engine.read(agent);
  const configs=state.servers.filter(c=>!c.needsSignIn&&(provider!=='codex'||c.transport!=='sse'));
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  const servers=[{name:'openpikzels',host:true},...configs],run={agent,servers,capability,onCard,signal:controller.signal};this.runs.set(id,run);
  return {servers:servers.map(s=>({name:s.name,url:origin+'/bridge/'+id+'/'+s.name,capability})),close:()=>{controller.abort();signal?.removeEventListener('abort',abort);this.runs.delete(id);},omittedSse:provider==='codex'?state.servers.filter(c=>c.transport==='sse').map(c=>c.name):[]};
 }
 async handle(req,res,body){
  const [, ,id,name]=new URL(req.url,'http://local').pathname.split('/'),run=this.runs.get(id),server=run?.servers.find(s=>s.name===name),bearer=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,''));
  if(!server||bearer.length!==run.capability.length||!timingSafeEqual(bearer,Buffer.from(run.capability))){res.writeHead(403);res.end();return;}
  const mcp=new Server({name:server.name,version:'2.0.0'},{capabilities:{tools:{}}});
  mcp.setRequestHandler(ListToolsRequestSchema,async()=>({tools:server.host?await this.engine.hostTools(run.agent):await this.engine.upstreamTools(run.agent,server)}));
  mcp.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
   try{if(run.signal.aborted)throw new Error('Cancelled.');const signal=extra.signal?AbortSignal.any([run.signal,extra.signal]):run.signal;const result=server.host?await this.engine.hostCall(run.agent,request.params.name,request.params.arguments||{}):await this.engine.upstreamCall(run.agent,server,request.params.name,request.params.arguments||{},signal);
    if(findPending((await this.engine.read(run.agent)).messages))res.once('finish',()=>setTimeout(run.onCard,25));
    return result;
   }catch{return {isError:true,content:[{type:'text',text:'Tool input or action failed. No credential values are available. Correct the input or ask the user through a card.'}]};}
  });
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close',()=>{transport.close();mcp.close();});await mcp.connect(transport);await transport.handleRequest(req,res,body);
 }
}
