import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync as requireAccess} from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname} from 'node:path';
import {makeRunner,providerName,cliEnvironment} from './core.mjs';
import {homedir} from 'node:os';
import {Engine,ToolBridge,PlanState,codexDiscovery,claudeDiscovery,runAgent,callbackHtml,query} from './runtime.mjs';
const directory=dirname(fileURLToPath(import.meta.url));
export function openBrowser(url){
 const command=process.platform==='darwin'?'/usr/bin/open':process.platform==='win32'?null:'xdg-open';
 if(command)execFile(command,[url],()=>{});
}
function launchLogin(provider){
 providerName(provider);
 return new Promise((resolve,reject)=>{
  const command=process.platform==='darwin'?'/usr/bin/open':process.platform==='linux'?'x-terminal-emulator':null;
  const args=process.platform==='darwin'?['-a','Terminal',join(directory,'login-'+provider+'.command')]:['-e',process.execPath,join(directory,'login.mjs'),provider];
  if(!command)return reject(new Error('Open the official CLI to sign in on this operating system.'));
  execFile(command,args,error=>error?reject(new Error('Could not open the official sign-in terminal.')):resolve());
 });
}
export async function createCompanion({port=48763,runner=makeRunner(),login=launchLogin,runTask=runAgent,readTelemetry,engine:providedEngine}={}){
 const token=randomBytes(32).toString('hex');let active=null;
 const engine=providedEngine||new Engine(join(homedir(),'.openpikzels','companion')),bridge=new ToolBridge(engine),plans=new PlanState(),probes=new Map();
 const telemetry=readTelemetry|| (async provider=>{if(probes.has(provider))return probes.get(provider);const p=(async()=>{const status=await runner.inspect(provider);if(!status.authenticated)return {...plans.view(provider),unavailable:'Sign in through the official CLI to read usage.'};const result=provider==='codex'?await codexDiscovery():await claudeDiscovery({sdk:{query},executable:cliEnvironment().PATH.split(':').map(p=>join(p,'claude')).find(p=>{try{return requireAccess(p);}catch{return false;}})});return {...plans.record(provider,result.windows,result.models),unavailable:result.unavailable};})();probes.set(provider,p);try{return await p;}finally{probes.delete(provider);}});
 const html=await readFile(join(directory,'index.html'),'utf8'),js=await readFile(join(directory,'ui.js'),'utf8');
 const server=createServer(async(req,res)=>{
  const origin='http://127.0.0.1:'+server.address().port;
  const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
  try{
   if(req.headers.host!==new URL(origin).host)return send(403,{error:'Open the companion at its local address.'});
   if(req.method==='GET'&&req.url?.startsWith('/api/mcp/oauth/callback?')){
     const nonce=randomBytes(18).toString('base64'),result=await engine.oauth.callback(new URL(req.url,origin).searchParams,req.headers.cookie,origin);
     if(result.ok)await engine.connected(result.agent,result.name).catch(()=>{});
     res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':result.cookie,'Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; base-uri 'none'; frame-ancestors 'none'"});res.end(callbackHtml(result,origin,nonce));return;
   }
   if(req.url?.startsWith('/bridge/')){
    if(req.method!=='POST')return send(405,{error:'Unsupported bridge method.'});
    let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>64000)return send(413,{error:'Too large.'});chunks.push(c);}
    await bridge.handle(req,res,JSON.parse(Buffer.concat(chunks).toString()));return;
   }
   if(req.method==='GET'&&req.url==='/')return send(200,html.replace('CSRF_TOKEN',''),'text/html; charset=utf-8');
   if(req.method==='GET'&&req.url==='/ui.js')return send(200,js,'application/javascript');
   if(req.method!=='POST')return send(405,{error:'Unsupported request.'});
   const supplied=Buffer.from(req.headers['x-openpikzels-client']||'');
   if(req.headers.origin!==origin||supplied.length!==token.length||!timingSafeEqual(supplied,Buffer.from(token)))return send(403,{error:'Open this action from the local companion.'});
   if(req.headers['content-type']!=='application/json')return send(415,{error:'Use a JSON request.'});
   let chunks=[],bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>64000)return send(413,{error:'The request is too large.'});chunks.push(chunk);}
   const body=Buffer.concat(chunks).toString('utf8');
   let input;try{input=JSON.parse(body);}catch{return send(400,{error:'The request was incomplete.'});}
   const agent=engine.agent(input.agent||'default');
   if(req.url==='/api/telemetry')return send(200,await telemetry(providerName(input.provider)));
   if(req.url==='/api/agent')return send(200,await engine.snapshot(agent));
   if(req.url==='/api/approvals/revoke'){await engine.revokeApprovals(agent);return send(200,{revoked:true});}
   if(req.url==='/api/agent/settings'){const allowed=['ask_user','request_approval','request_secret','suggest_service','request_mcp_sign_in','request_takeover','web','vision'];if(!input.capabilities||Object.entries(input.capabilities).some(([k,v])=>!allowed.includes(k)||typeof v!=='boolean'))return send(400,{error:'Invalid capability settings.'});await engine.locked(agent,async()=>{const s=await engine.read(agent);s.capabilities={...s.capabilities,...input.capabilities};await engine.save(agent,s);});return send(200,{saved:true});}
   if(req.url==='/api/answer')return send(200,await engine.answer(agent,input.id,input.value||{}));
   if(req.url==='/api/secrets/request')return send(200,await engine.secretCard(agent,input.secrets));
   if(req.url==='/api/secrets')return send(200,await engine.secrets(agent,input.id,input.values));
   if(req.url==='/api/mcp/register')return send(200,await engine.register(agent,input.config,{allowCommand:input.allowCommand===true,allowSecrets:input.allowSecrets===true}));
   if(req.url==='/api/mcp/remove'){if(active)return send(409,{error:'Cancel the current task first.'});await engine.locked(agent,async()=>{const s=await engine.read(agent);s.servers=s.servers.filter(c=>c.name!==input.name);await engine.save(agent,s);await engine.vault.set(engine.oauth.id(agent,input.name),null);});return send(200,{removed:true});}
   if(req.url==='/api/mcp/oauth/discover'){const c=await engine.config(agent,input.name);const d=await engine.oauth.discover(c);return send(200,{issuer:d.authorizationServerUrl,deviceSupported:!!d.authorizationServerMetadata?.device_authorization_endpoint});}
   if(req.url==='/api/mcp/oauth/start'){const c=await engine.config(agent,input.name),result=await engine.oauth.start(agent,c,origin);res.setHeader('Set-Cookie',result.cookie);return send(200,{url:result.url,state:result.state});}
   if(req.url==='/api/mcp/oauth/device'){const c=await engine.config(agent,input.name);return send(200,await engine.oauth.deviceStart(agent,c));}
   if(req.url==='/api/mcp/oauth/device-complete'){const c=await engine.config(agent,input.name);const result=await engine.oauth.deviceComplete(agent,c);if(result.ok)await engine.connected(agent,c.name);return send(200,result);}
   if(req.url==='/api/status'){
    const status={};for(const provider of ['claude','codex'])status[provider]=await runner.inspect(provider);
    return send(200,status);
   }
   if(req.url==='/api/login'){
    if(active)return send(409,{error:'Cancel the current task before signing in.'});
    await login(providerName(input.provider));return send(200,{message:'Complete sign-in in the official CLI window, then refresh sign-in status here.'});
   }
   if(req.url==='/api/cancel'){active?.abort();return send(200,{cancelled:true});}
   if(req.url==='/api/account/link'){const result=await engine.linkAccount(agent,origin);res.setHeader('Set-Cookie',result.cookie);return send(200,{url:result.url,state:result.state});}
   if(req.url==='/api/account/status')return send(200,await engine.accountStatus(agent));
   if(req.url==='/api/account/unlink')return send(200,await engine.unlinkAccount(agent));
   if(req.url!=='/api/run')return send(404,{error:'Unknown local action.'});
   if(active)return send(409,{error:'A task is already running. Wait or cancel it.'});
   const controller=new AbortController();active=controller;
   const disconnect=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnect);
   try{const provider=providerName(input.provider);if(plans.view(provider).stale)await telemetry(provider);
    const result=await runTask({engine,bridge,plans,runner,provider,task:input.task,brief:input.brief,model:input.model||undefined,effort:input.effort||undefined,agent,origin,signal:controller.signal});send(200,result);}
   finally{res.removeListener('close',disconnect);if(active===controller)active=null;}
  }catch(error){if(res.headersSent){res.destroy();return;}send(400,{error:req.url?.startsWith('/api/mcp/oauth/')?'MCP sign-in could not finish. Start sign-in again or check the service.':error instanceof Error?error.message:'The local action failed.'});}
 });
 server.on('close',()=>{active?.abort();void engine.close();});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 server.toolBridge=bridge;
 server.launchUrl=()=> 'http://127.0.0.1:'+server.address().port+'/#'+token;
 return server;
}
export function installShutdownHandlers(server,events=process){
 for(const signal of ['SIGINT','SIGTERM','SIGHUP'])events.on(signal,()=>{server.close();server.closeAllConnections();});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=await createCompanion();openBrowser(server.launchUrl());
 console.log('OpenPikzels local companion is running. Your browser opens automatically. Close this process to stop it.');
 installShutdownHandlers(server);
}
