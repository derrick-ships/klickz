import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {Engine} from './engine.mjs';
import {runAgent} from './agent-runner.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const IMAGE_LIMIT=5*1024*1024;

async function tempEngine(t,capabilities={}){
 const directory=await mkdtemp(join(tmpdir(),'openpikzels-vision-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const engine=new Engine(directory);
 t.after(()=>engine.close());
 await engine.save('default',{messages:[],servers:[],capabilities});
 const workspace=join(directory,'workspace');
 await mkdir(workspace,{recursive:true,mode:0o700});
 engine.beginWorkspace('default',workspace);
 return {engine,directory,workspace};
}

async function fixture(workspace,name,{width=32,height=32,format='png'}={}){
 const path=join(workspace,name);
 const image=sharp({create:{width,height,channels:3,background:'#c43c3c'}});
 const buffer=format==='jpeg'?await image.jpeg().toBuffer():format==='webp'?await image.webp().toBuffer():await image.png().toBuffer();
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 await writeFile(path,buffer,{mode:0o600});
 return path;
}

function imagePart(result){
 const part=(result.content||[]).find(c=>c.type==='image');
 assert.ok(part, 'expected MCP image content');
 assert.equal(typeof part.data,'string');
 assert.ok(part.data.length>0);
 assert.match(part.mimeType||'',/^image\/(png|jpeg|webp)$/);
 return part;
}

async function metadataFrom(result){
 const part=imagePart(result);
 return sharp(Buffer.from(part.data,'base64')).metadata();
}

test('in-workspace PNG, JPEG and WebP are returned as MCP image content',async t=>{
 const {engine,workspace}=await tempEngine(t);
 const cases=[['shot.png','png','image/png'],['shot.jpeg','jpeg','image/jpeg'],['shot.webp','webp','image/webp']];
 for(const [name,format,mime] of cases){
  await fixture(workspace,name,{format});
  const result=await engine.hostCall('default','view_image',{path:name});
  const part=imagePart(result);
  assert.equal(part.mimeType,mime);
  const meta=await sharp(Buffer.from(part.data,'base64')).metadata();
  assert.equal(meta.format,format==='jpeg'?'jpeg':format);
 }
});

test('an image larger than 1568 px comes back at most 1568 on the long side, and a small image is not enlarged',async t=>{
 const {engine,workspace}=await tempEngine(t);
 await fixture(workspace,'wide.png',{width:2000,height:1000,format:'png'});
 const large=await metadataFrom(await engine.hostCall('default','view_image',{path:'wide.png'}));
 assert.ok(Math.max(large.width,large.height)<=1568);
 assert.equal(large.width,1568);
 assert.equal(large.height,784);
 await fixture(workspace,'small.png',{width:64,height:32,format:'png'});
 const small=await metadataFrom(await engine.hostCall('default','view_image',{path:'small.png'}));
 assert.equal(small.width,64);
 assert.equal(small.height,32);
});

test('files over 5 MB, non-image files and disallowed types are rejected',async t=>{
 const {engine,workspace}=await tempEngine(t);
 const huge=join(workspace,'huge.png');
 await writeFile(huge,Buffer.concat([await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer(),Buffer.alloc(IMAGE_LIMIT,1)]));
 await assert.rejects(engine.hostCall('default','view_image',{path:'huge.png'}),/5 MB|too large|limit|smaller/i);
 await writeFile(join(workspace,'notes.txt'),'not an image',{mode:0o600});
 await assert.rejects(engine.hostCall('default','view_image',{path:'notes.txt'}),/png|jpeg|webp|image/i);
 await sharp({create:{width:16,height:16,channels:3,background:'red'}}).gif().toFile(join(workspace,'anim.gif'));
 await assert.rejects(engine.hostCall('default','view_image',{path:'anim.gif'}),/png|jpeg|webp|image/i);
});

test('traversal, absolute paths outside the workspace and symlink escapes are rejected',async t=>{
 const {engine,workspace,directory}=await tempEngine(t);
 const outsideDir=await mkdtemp(join(tmpdir(),'openpikzels-vision-out-'));
 t.after(()=>rm(outsideDir,{recursive:true,force:true}));
 const outside=join(outsideDir,'secret.png');
 await fixture(outsideDir,'secret.png');
 await fixture(workspace,'ok.png');
 await assert.rejects(engine.hostCall('default','view_image',{path:'../secret.png'}),/workspace|path|escape/i);
 await assert.rejects(engine.hostCall('default','view_image',{path:outside}),/workspace|path|escape/i);
 await symlink(outside,join(workspace,'link.png'));
 await assert.rejects(engine.hostCall('default','view_image',{path:'link.png'}),/workspace|path|escape/i);
 const nested=join(workspace,'downloads');
 await mkdir(nested,{recursive:true});
 await assert.rejects(engine.hostCall('default','view_image',{path:'downloads/../../'+join(dirname(directory),'nope.png')}),/workspace|path|escape/i);
});

test('a sharp load failure gives a clear error and does not crash the companion',async t=>{
 const {workspace}=await tempEngine(t);
 await fixture(workspace,'shot.png');
 const {viewImage}=await import('./vision-tools.mjs');
 await assert.rejects(viewImage('shot.png',{workspace,loadSharp:async()=>{throw new Error('sharp missing');}}),/image processing|unavailable|sharp/i);
 assert.equal(process.exitCode==null||process.exitCode===0,true);
});

test('the vision tool is absent when the capability is off',async t=>{
 const off=await tempEngine(t,{vision:false});
 const names=(await off.engine.hostTools('default')).map(tool=>tool.name);
 assert.equal(names.includes('view_image'),false);
 await assert.rejects(off.engine.hostCall('default','view_image',{path:'shot.png'}),/disabled|unsupported|vision/i);
 const on=await tempEngine(t);
 const enabled=(await on.engine.hostTools('default')).map(tool=>tool.name);
 assert.ok(enabled.includes('view_image'));
});

test('when Codex cannot use MCP image results, the runner attaches brief images with -i',async t=>{
 const {engine,workspace}=await tempEngine(t);
 await fixture(workspace,'downloads/x.png');
 const calls=[];
 const execute=async(provider,args)=>{calls.push({provider,args});return {code:0,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}})+'\n'};};
 const stub={inspect:async()=>({authenticated:true,installed:true})};
 const plans={gate:()=>({allowed:true}),view:()=>({models:[],stale:false})};
 const bridge={open:async()=>({servers:[{name:'openpikzels',url:'http://127.0.0.1/bridge',capability:'c'}],close(){},omittedSse:[]})};
 await runAgent({engine,bridge,plans,runner:stub,provider:'codex',task:'titles',brief:'Please describe downloads/x.png',origin:'http://127.0.0.1',execute,codexMcpImages:async()=>false});
 const args=calls.at(-1).args;
 const flag=args.indexOf('-i');
 assert.ok(flag>=0);
 assert.equal(args[flag+1],join(workspace,'downloads/x.png'));
 await runAgent({engine,bridge,plans,runner:stub,provider:'codex',task:'titles',brief:'Please describe downloads/x.png',origin:'http://127.0.0.1',execute,codexMcpImages:async()=>true});
 const mcpFirst=calls.at(-1).args;
 assert.equal(mcpFirst.includes('-i'),false);
});

test('view_image still finds a file in the standing workspace after a run directory is attached',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'openpikzels-vision-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const engine=new Engine(directory);
 t.after(()=>engine.close());
 await engine.save('default',{messages:[],servers:[],capabilities:{}});
 const standing=join(directory,'default','workspace');
 await fixture(standing,'downloads/x.png');
 const runDir=await mkdtemp(join(tmpdir(),'openpikzels-vision-run-'));
 t.after(()=>rm(runDir,{recursive:true,force:true}));
 engine.beginWorkspace('default',runDir);
 const part=imagePart(await engine.hostCall('default','view_image',{path:'downloads/x.png'}));
 assert.equal(part.mimeType,'image/png');
});

test('the default Codex run attaches a brief image with -i',async t=>{
 const {engine,workspace}=await tempEngine(t);
 await fixture(workspace,'downloads/x.png');
 const calls=[];
 const execute=async(provider,args)=>{calls.push({provider,args});return {code:0,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}})+'\n'};};
 const stub={inspect:async()=>({authenticated:true,installed:true})};
 const plans={gate:()=>({allowed:true}),view:()=>({models:[],stale:false})};
 const bridge={open:async()=>({servers:[{name:'openpikzels',url:'http://127.0.0.1/bridge',capability:'c'}],close(){},omittedSse:[]})};
 await runAgent({engine,bridge,plans,runner:stub,provider:'codex',task:'titles',brief:'describe downloads/x.png',origin:'http://127.0.0.1',execute});
 const args=calls.at(-1).args;
 const flag=args.indexOf('-i');
 assert.ok(flag>=0);
 assert.equal(args[flag+1],join(workspace,'downloads/x.png'));
});

test('Codex -i skips out-of-workspace paths, traversal, symlinks, oversized files and disallowed types',async t=>{
 const {engine,workspace,directory}=await tempEngine(t);
 await fixture(workspace,'downloads/ok.png');
 const outsideDir=await mkdtemp(join(tmpdir(),'openpikzels-vision-out-'));
 t.after(()=>rm(outsideDir,{recursive:true,force:true}));
 await fixture(outsideDir,'secret.png');
 await fixture(directory,'escaped.png');
 await symlink(join(outsideDir,'secret.png'),join(workspace,'link.png'));
 await writeFile(join(workspace,'huge.png'),Buffer.concat([
  await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer(),
  Buffer.alloc(IMAGE_LIMIT,1),
 ]));
 await sharp({create:{width:16,height:16,channels:3,background:'red'}}).gif().toFile(join(workspace,'anim.gif'));
 const calls=[];
 const execute=async(provider,args)=>{calls.push({provider,args});return {code:0,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}})+'\n'};};
 const stub={inspect:async()=>({authenticated:true,installed:true})};
 const plans={gate:()=>({allowed:true}),view:()=>({models:[],stale:false})};
 const bridge={open:async()=>({servers:[{name:'openpikzels',url:'http://127.0.0.1/bridge',capability:'c'}],close(){},omittedSse:[]})};
 const brief='describe downloads/ok.png ../escaped.png link.png huge.png anim.gif '+join(outsideDir,'secret.png');
 await runAgent({engine,bridge,plans,runner:stub,provider:'codex',task:'titles',brief,origin:'http://127.0.0.1',execute});
 const args=calls.at(-1).args;
 const attached=[];
 for(let i=0;i<args.length;i++)if(args[i]==='-i')attached.push(args[i+1]);
 assert.deepEqual(attached,[join(workspace,'downloads/ok.png')]);
});
