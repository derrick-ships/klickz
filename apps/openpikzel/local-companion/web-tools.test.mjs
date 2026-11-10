import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readdir,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installNetworkFixture} from './web-network-fixture.mjs';

const net=installNetworkFixture();
const {safeFetch}=await import('./mcp-runtime.mjs');
const {Engine}=await import('./engine.mjs');
const {runAgent}=await import('./agent-runner.mjs');

const publicUrl='https://1.1.1.1/article';
const downloadUrl='https://1.1.1.1/file.bin';
const twoMb=2*1024*1024,fourMb=4*1024*1024,twentyMb=20*1024*1024;

async function tempEngine(t,capabilities={}){
 const directory=await mkdtemp(join(tmpdir(),'openpikzels-web-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const engine=new Engine(directory);
 t.after(()=>engine.close());
 await engine.save('default',{messages:[],servers:[],capabilities});
 return {engine,directory};
}
function toolText(result){
 return (result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
}
async function readSafe(input,init){
 const response=await safeFetch(input,init);
 return Buffer.from(await response.arrayBuffer());
}

test('private, loopback and redirect-to-private targets are blocked, including with a custom maxBytes',async()=>{
 net.resetNetwork();
 for(const url of ['https://127.0.0.1/','https://10.0.0.1/','https://192.168.1.1/','https://[::1]/']){
  await assert.rejects(safeFetch(url,{maxBytes:twentyMb}),/private|local|HTTPS/i);
  assert.equal(net.mockRequests().length,0);
 }
 net.resetNetwork();
 net.mockResponse({status:302,headers:{location:'https://127.0.0.1/secret'},body:''});
 await assert.rejects(safeFetch(publicUrl,{maxBytes:twentyMb}),/redirect/i);
});

test('safeFetch keeps a 4 MB default cap and honors a larger per-call maxBytes',async()=>{
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'application/octet-stream'},body:Buffer.alloc(fourMb+1,1)});
 await assert.rejects(readSafe(publicUrl),/limit/i);
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'application/octet-stream'},body:Buffer.alloc(fourMb,1)});
 assert.equal((await readSafe(publicUrl)).length,fourMb);
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'application/octet-stream'},body:Buffer.alloc(fourMb+1,1)});
 assert.equal((await readSafe(publicUrl,{maxBytes:twentyMb})).length,fourMb+1);
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'application/octet-stream'},body:Buffer.alloc(twentyMb+1,1)});
 await assert.rejects(readSafe(downloadUrl,{maxBytes:twentyMb}),/limit/i);
});

test('fetch_url returns stripped text labeled as untrusted data and enforces a 2 MB cap',async t=>{
 const {engine}=await tempEngine(t);
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'text/html'},body:'<html><body><h1>Hello</h1><script>secret()</script><p>World</p></body></html>'});
 const result=await engine.hostCall('default','fetch_url',{url:publicUrl});
 const text=toolText(result);
 assert.match(text,/hello/i);
 assert.match(text,/world/i);
 assert.doesNotMatch(text,/<h1>|<script|secret\(\)/i);
 assert.match(text,/untrusted data/i);
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'text/plain'},body:Buffer.alloc(twoMb+1,97)});
 await assert.rejects(engine.hostCall('default','fetch_url',{url:publicUrl}),/limit|cap|large/i);
});

test('download_file saves into AGENT_WORKSPACE/downloads, blocks path traversal, and enforces a 20 MB cap',async t=>{
 const {engine,directory}=await tempEngine(t);
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'application/octet-stream'},body:Buffer.from('fixture-bytes')});
 const result=await engine.hostCall('default','download_file',{url:downloadUrl,filename:'report.bin'});
 const text=toolText(result);
 assert.match(text,/untrusted data/i);
 const saved=JSON.parse(text.includes('{')?text.slice(text.indexOf('{')):text);
 const path=saved.path||saved.file||saved.filename;
 assert.ok(path);
 assert.match(path,/downloads[\\/]report\.bin$/);
 const bytes=await readFile(path);
 assert.equal(bytes.toString(),'fixture-bytes');
 const workspaceRoot=directory;
 assert.ok(path.startsWith(workspaceRoot)||path.includes('downloads'));
 const outside=join(directory,'escaped.bin');
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'application/octet-stream'},body:Buffer.from('nope')});
 await assert.rejects(engine.hostCall('default','download_file',{url:downloadUrl,filename:'../escaped.bin'}),/workspace|downloads|path|escape/i);
 await assert.rejects(stat(outside));
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'application/octet-stream'},body:Buffer.alloc(twentyMb+1,1)});
 await assert.rejects(engine.hostCall('default','download_file',{url:downloadUrl,filename:'huge.bin'}),/limit|cap|large/i);
});

test('web tools send no cookies or credentials',async t=>{
 const {engine}=await tempEngine(t);
 net.resetNetwork();
 net.mockResponse({status:200,headers:{'content-type':'text/plain'},body:'ok'});
 await engine.hostCall('default','fetch_url',{url:publicUrl});
 assert.equal(net.mockRequests().length,1);
 const headers=Object.fromEntries(Object.entries(net.mockRequests()[0].headers).map(([k,v])=>[k.toLowerCase(),v]));
 for(const name of ['cookie','authorization','proxy-authorization'])assert.equal(headers[name],undefined);
});

test('web off removes the tools and keeps web_search disabled; web on enables search',async t=>{
 const off=await tempEngine(t,{web:false});
 const names=(await off.engine.hostTools('default')).map(t=>t.name);
 assert.equal(names.includes('fetch_url'),false);
 assert.equal(names.includes('download_file'),false);
 await assert.rejects(off.engine.hostCall('default','fetch_url',{url:publicUrl}),/disabled|unsupported|web/i);
 const on=await tempEngine(t);
 const enabled=(await on.engine.hostTools('default')).map(t=>t.name);
 assert.ok(enabled.includes('fetch_url'));
 assert.ok(enabled.includes('download_file'));
 const calls=[];
 const execute=async(provider,args)=>{calls.push({provider,args});return {code:0,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}})+'\n'};};
 const stub={
  inspect:async()=>({authenticated:true,installed:true}),
 };
 const plans={gate:()=>({allowed:true}),view:()=>({models:[],stale:false})};
 const bridge={open:async()=>({servers:[{name:'openpikzels',url:'http://127.0.0.1/bridge',capability:'c'}],close(){},omittedSse:[]})};
 await runAgent({engine:off.engine,bridge,plans,runner:stub,provider:'codex',task:'titles',brief:'A factual video brief',origin:'http://127.0.0.1',execute});
 const offArg=calls.at(-1).args.find(a=>String(a).includes('web_search'));
 assert.equal(offArg,'web_search="disabled"');
 await runAgent({engine:on.engine,bridge,plans,runner:stub,provider:'codex',task:'titles',brief:'A factual video brief',origin:'http://127.0.0.1',execute});
 const onArg=calls.at(-1).args.find(a=>String(a).includes('web_search'));
 assert.ok(onArg);
 assert.notEqual(onArg,'web_search="disabled"');
});
