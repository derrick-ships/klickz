import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname} from 'node:path';
import {makeRunner,providerName} from './core.mjs';
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
export async function createCompanion({port=48763,runner=makeRunner(),login=launchLogin}={}){
 const token=randomBytes(32).toString('hex');let active=null;
 const html=await readFile(join(directory,'index.html'),'utf8'),js=await readFile(join(directory,'ui.js'),'utf8');
 const server=createServer(async(req,res)=>{
  const origin='http://127.0.0.1:'+server.address().port;
  const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
  try{
   if(req.headers.host!==new URL(origin).host)return send(403,{error:'Open the companion at its local address.'});
   if(req.method==='GET'&&req.url==='/')return send(200,html.replace('CSRF_TOKEN',''),'text/html; charset=utf-8');
   if(req.method==='GET'&&req.url==='/ui.js')return send(200,js,'application/javascript');
   if(req.method!=='POST')return send(405,{error:'Unsupported request.'});
   const supplied=Buffer.from(req.headers['x-openpikzels-client']||'');
   if(req.headers.origin!==origin||supplied.length!==token.length||!timingSafeEqual(supplied,Buffer.from(token)))return send(403,{error:'Open this action from the local companion.'});
   if(req.headers['content-type']!=='application/json')return send(415,{error:'Use a JSON request.'});
   let chunks=[],bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>64000)return send(413,{error:'The request is too large.'});chunks.push(chunk);}
   const body=Buffer.concat(chunks).toString('utf8');
   let input;try{input=JSON.parse(body);}catch{return send(400,{error:'The request was incomplete.'});}
   if(req.url==='/api/status'){
    const status={};for(const provider of ['claude','codex'])status[provider]=await runner.inspect(provider);
    return send(200,status);
   }
   if(req.url==='/api/login'){
    if(active)return send(409,{error:'Cancel the current task before signing in.'});
    await login(providerName(input.provider));return send(200,{message:'Complete sign-in in the official CLI window, then refresh sign-in status here.'});
   }
   if(req.url==='/api/cancel'){active?.abort();return send(200,{cancelled:true});}
   if(req.url!=='/api/run')return send(404,{error:'Unknown local action.'});
   if(active)return send(409,{error:'A task is already running. Wait or cancel it.'});
   const controller=new AbortController();active=controller;
   const disconnect=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnect);
   try{const text=await runner.run(input.provider,input.task,input.brief,controller.signal);send(200,{text});}
   finally{res.removeListener('close',disconnect);if(active===controller)active=null;}
  }catch(error){send(400,{error:error instanceof Error?error.message:'The local action failed.'});}
 });
 server.on('close',()=>active?.abort());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
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
