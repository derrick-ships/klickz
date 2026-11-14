import {registerHooks} from 'node:module';
import {Readable,Writable} from 'node:stream';

const queue=[],captured=[];
let socketHost;

export function mockResponse({status=200,headers={'content-type':'text/html; charset=utf-8'},body=Buffer.alloc(0)}={}){
 queue.push({status,headers,body:Buffer.isBuffer(body)?body:Buffer.from(body)});
}
export function mockRequests(){return captured;}
export function resetNetwork(){queue.length=0;captured.length=0;socketHost=undefined;}
export function resolveSocketAs(host){socketHost=host;}

function fakeRequest(url,options,cb){
 if(typeof options==='function'){cb=options;options=typeof url==='object'&&url&&!Array.isArray(url)?url:{};}
 const headers=options?.headers||{};
 captured.push({url:String(url),method:options?.method||'GET',headers});
 const queued=queue.shift()||{status:200,headers:{},body:Buffer.alloc(0)};
 const req=new Writable({
  write(c,e,d){d();},
  final(d){
   d();
   if(socketHost){options.lookup(socketHost,{},error=>{if(error)req.emit('error',error);});return;}
   const response=Readable.from([queued.body]);
   response.statusCode=queued.status;
   response.headers=queued.headers;
   cb(response);
  }
 });
 req.setTimeout=()=>req;
 req.destroy=err=>{if(err)queueMicrotask(()=>req.emit('error',err));};
 return req;
}

export function installNetworkFixture(){
 registerHooks({
  load(url,context,nextLoad){
   if(url==='node:https')return {format:'module',shortCircuit:true,source:'export function request(...args){return globalThis.__openpikzelsFakeHttpsRequest(...args);}\n'};
   return nextLoad(url,context);
  }
 });
 globalThis.__openpikzelsFakeHttpsRequest=fakeRequest;
 return {mockResponse,mockRequests,resetNetwork,resolveSocketAs};
}
