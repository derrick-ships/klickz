import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {lookup as lookupCallback} from 'node:dns';
import {request as httpsRequest} from 'node:https';
import {Readable,Transform} from 'node:stream';
import {isIP} from 'node:net';
import {cliEnvironment} from './core.mjs';
export function transportKind(c){return c.transport||(c.command?'stdio':new URL(c.url).pathname.replace(/\/$/,'').endsWith('/sse')?'sse':'http');}
export function validateConfig(c){
 if(!c||typeof c!=='object'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(c.name)||c.name==='openpikzels')throw new Error('Choose a unique MCP name using letters, numbers and dashes.');
 const transport=transportKind(c);if(!['stdio','sse','http'].includes(transport))throw new Error('Unsupported MCP transport.');
 if(transport==='stdio'&&(!c.command||typeof c.command!=='string'))throw new Error('A command is required.');
 if(transport!=='stdio'&&(!c.url||new URL(c.url).protocol!=='https:'))throw new Error('Remote MCP servers must use HTTPS.');
 if(c.args&&(!Array.isArray(c.args)||c.args.some(x=>typeof x!=='string')))throw new Error('Arguments must be strings.');
 for(const field of ['env','headers'])if(c[field]&&Object.entries(c[field]).some(([k,v])=>typeof v!=='string'||/[\r\n]/.test(k)))throw new Error('Invalid MCP configuration.');
 return {...c,transport};
}
function substitute(value,env){return value.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g,(_,name)=>{if(!Object.hasOwn(env,name))throw new Error('Missing agent secret: '+name);return env[name];});}
export async function prepareServer(config,{agentEnv={},workspace='',publicUrl='https://openpikzels.com',oauth,refresh,identity={},localPackage}={}){
 const c=validateConfig(config),env={...agentEnv,AGENT_WORKSPACE:workspace,PUBLIC_ENGINE_URL:publicUrl};
 const token=refresh?await refresh():oauth; // 1. Refresh first. OAuth values are opaque, never templated.
 for(const field of ['command','url'])if(c[field])c[field]=substitute(c[field],env);
 c.args=(c.args||[]).map(x=>substitute(x,env));
 c.env=Object.fromEntries(Object.entries(c.env||{}).map(([k,v])=>[k,substitute(v,env)]));
 if(token?.access_token){c.headers={...c.headers};for(const key of Object.keys(c.headers))if(key.toLowerCase()==='authorization')delete c.headers[key];}
 c.headers=Object.fromEntries(Object.entries(c.headers||{}).map(([k,v])=>[k,substitute(v,env)]));
 if(token?.access_token){for(const k of Object.keys(c.headers))if(k.toLowerCase()==='authorization')delete c.headers[k];c.headers.Authorization='Bearer '+token.access_token;}
 // 3. Identity is literal and wins. 4. Never silently download an npx package.
 c.headers={...c.headers,...identity};
 if(c.command==='npx'){const installed=await localPackage?.(c.args);if(!installed)throw new Error('Install this MCP package locally first; automatic npx downloads are disabled.');c.command=installed.command;c.args=installed.args;}
 return c;
}
function publicAddress(ip){
 if(isIP(ip)===4){const p=ip.split('.').map(Number);return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&(p[1]===168||p[1]===0))||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===198&&(p[1]===18||p[1]===19)));}
 const s=ip.toLowerCase();return isIP(ip)===6&&!(s==='::'||s==='::1'||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('fe8')||s.startsWith('fe9')||s.startsWith('fea')||s.startsWith('feb')||s.startsWith('::ffff:'));
}
export async function safeUrl(input){const u=new URL(input);if(u.protocol!=='https:'||u.username||u.password||u.hash)throw new Error('Use a public HTTPS URL without credentials.');
 const host=u.hostname.replace(/^\[|\]$/g,'');const records=isIP(host)?[{address:host}]:await lookup(host,{all:true});
 if(!records.length||records.some(r=>!publicAddress(r.address)))throw new Error('Private and local network MCP addresses are blocked.');return u;}
export async function safeFetch(input,init={}){
 const url=await safeUrl(typeof input==='string'?input:input.url||String(input));
 return new Promise((resolve,reject)=>{
  const headers=new Headers(init.headers),body=init.body instanceof URLSearchParams?init.body.toString():init.body;
  const request=httpsRequest(url,{method:init.method||'GET',headers:Object.fromEntries(headers),agent:false,lookup:(host,options,callback)=>{
   lookupCallback(host,{...options,all:true},(error,records)=>{
    if(error)return callback(error);
    if(!records.length||records.some(r=>!publicAddress(r.address)))return callback(new Error('Private network addresses are blocked.'));
    // Validate the very addresses handed to the socket, preventing DNS-rebinding races.
    if(options.all)callback(null,records);else callback(null,records[0].address,records[0].family);
   });
  }},response=>{
   request.setTimeout(0);
   const status=response.statusCode||500;
   if(status>=300&&status<400&&response.headers.location){response.destroy();reject(new Error('MCP redirects require an explicit server URL.'));return;}
   let bytes=0;const limiter=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;done(bytes>4*1024*1024?new Error('MCP response exceeds the local limit.'):null,chunk);}});
   response.pipe(limiter);response.on('error',e=>limiter.destroy(e));limiter.on('error',()=>response.destroy());
   const responseHeaders=new Headers();for(const [key,value]of Object.entries(response.headers))if(value!==undefined)responseHeaders.set(key,Array.isArray(value)?value.join(', '):value);
   const stream=[204,205,304].includes(status)?null:Readable.toWeb(limiter);if(!stream)response.resume();
   resolve(new Response(stream,{status,headers:responseHeaders}));
  });
  const abort=()=>request.destroy(new Error('MCP request cancelled.'));
  init.signal?.addEventListener('abort',abort,{once:true});
  request.on('close',()=>init.signal?.removeEventListener('abort',abort));request.on('error',reject);
  request.setTimeout(20000,()=>request.destroy(new Error('MCP connection timed out.')));
  if(init.signal?.aborted)return abort();
  if(body!==undefined&&body!==null&&typeof body!=='string'&&!Buffer.isBuffer(body)&&!(body instanceof Uint8Array)){request.destroy();reject(new Error('Unsupported MCP request body.'));return;}
  request.end(body);
 });
}
export class McpPool{
 constructor({connect,now=Date.now,idleMs=600000}={}){this.entries=new Map();this.now=now;this.idleMs=idleMs;this.connect=connect||dial;this.timer=setInterval(()=>this.sweep(),30000);this.timer.unref();}
 async acquire(agent,config){
  const key=agent+'/'+config.name,fingerprint=createHash('sha256').update(JSON.stringify(config)).digest('hex');let e=this.entries.get(key);
  if(e&&e.fingerprint!==fingerprint){this.entries.delete(key);await e.promise.then(c=>c.close()).catch(()=>{});e=null;}
  if(!e){e={fingerprint,at:this.now(),promise:this.connect(config)};this.entries.set(key,e);e.promise.catch(()=>{if(this.entries.get(key)===e)this.entries.delete(key);});}
  e.at=this.now();return e.promise;
 }
 async sweep(){for(const [key,e]of this.entries)if(this.now()-e.at>this.idleMs){this.entries.delete(key);await e.promise.then(c=>c.close()).catch(()=>{});}}
 async close(){clearInterval(this.timer);const all=[...this.entries.values()];this.entries.clear();await Promise.allSettled(all.map(e=>e.promise.then(c=>c.close())));}
}
async function dial(config){
 if(config.transport!=='stdio')await safeUrl(config.url);
 const client=new Client({name:'openpikzels-companion',version:'2.0.0'},{capabilities:{}});
 const options={requestInit:{headers:config.headers},fetch:safeFetch};
 const transport=config.transport==='stdio'?new StdioClientTransport({command:config.command,args:config.args,env:{...cliEnvironment(),...config.env},stderr:'ignore'}):config.transport==='sse'?new SSEClientTransport(new URL(config.url),options):new StreamableHTTPClientTransport(new URL(config.url),options);
 try{await client.connect(transport,{timeout:20000});return client;}catch(error){await client.close().catch(()=>{});throw error;}
}
export function cliServers(provider,servers){return servers.filter(c=>provider!=='codex'||transportKind(c)!=='sse');}
export function normalizeSchema(schema){
 if(!schema||typeof schema!=='object')return {type:'object',properties:{}};
 const variants=schema.oneOf||schema.anyOf;if(!Array.isArray(variants))return {...schema,type:'object',properties:schema.properties||{}};
 const objects=variants.every(x=>x.type==='object'||x.properties);
 if(!objects)return {type:'object',properties:{value:{anyOf:variants}},required:['value']};
 const properties=Object.create(null);for(const v of variants)for(const [key,value]of Object.entries(v.properties||{}))if(!['__proto__','constructor','prototype'].includes(key))properties[key]=value;
 return {type:'object',properties,required:(variants[0].required||[]).filter(k=>variants.every(x=>(x.required||[]).includes(k)))};
}
export async function registerServer(config,{probe,save,hasCredential=false}){
 const c=validateConfig(config),credential=hasCredential||Object.keys(c.headers||{}).some(k=>/authorization|key|token/i.test(k));
 try{const tools=await probe(c);await save(c);return {saved:true,tools:tools.tools||tools,needsSignIn:false};}
 catch(e){if(e.status===401||e.code===401||e.response?.status===401){
 if(credential)throw new Error('Credentials were rejected. Call request_secret with the credential name; configuration was not saved.');
 await save({...c,needsSignIn:true});return {saved:true,needsSignIn:true,instruction:'Call request_mcp_sign_in for '+c.name+'.'};
 }throw new Error('MCP probe failed; nothing was saved. Check the server URL, transport and installation.');}
}
