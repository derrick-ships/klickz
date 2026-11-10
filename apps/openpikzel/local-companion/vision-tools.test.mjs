import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {Engine} from './engine.mjs';
import {runAgent} from './agent-runner.mjs';
import {listedImagePaths,viewImage} from './vision-tools.mjs';

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


function seededPrng(seed){
 let s=seed>>>0;
 return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s;};
}

async function fourColorNoisePng({width=4200,height=4200,seed=20261110}={}){
 const colors=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
 const rand=seededPrng(seed);
 const raw=Buffer.alloc(width*height*3);
 for(let i=0;i<width*height;i++){
  const c=colors[rand()>>>30];
  const o=i*3;raw[o]=c[0];raw[o+1]=c[1];raw[o+2]=c[2];
 }
 return sharp(raw,{raw:{width,height,channels:3}}).png({compressionLevel:1,palette:true,colours:4,dither:0}).toBuffer();
}


async function listedFrom(t,brief,names){
 const directory=await mkdtemp(join(tmpdir(),'openpikzels-paths-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 await mkdir(directory,{recursive:true,mode:0o700});
 for(const name of names)await fixture(directory,name);
 return listedImagePaths(brief,{workspace:directory});
}

function attachedPaths(args){
 const attached=[];
 for(let i=0;i<args.length;i++)if(args[i]==='-i')attached.push(args[i+1]);
 return attached;
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

test('a 4200 px four-colour PNG under 5 MB is returned as a JPEG of at most 5 MB after resize',async t=>{
 const {engine,workspace}=await tempEngine(t);
 const input=await fourColorNoisePng();
 assert.ok(input.length<=IMAGE_LIMIT,`fixture input ${input.length} must be 5 MB or smaller`);
 assert.ok(input.length>4*1024*1024,`fixture input ${input.length} should be a hard-to-compress PNG`);
 await writeFile(join(workspace,'noisy.png'),input,{mode:0o600});
 const result=await engine.hostCall('default','view_image',{path:'noisy.png'});
 const part=imagePart(result);
 const output=Buffer.from(part.data,'base64');
 console.log('REPRO_OUTPUT',JSON.stringify({inputBytes:input.length,outputBytes:output.length,mimeType:part.mimeType}));
 assert.ok(output.length<=IMAGE_LIMIT,`output ${output.length} must be 5 MB or smaller`);
 assert.equal(part.mimeType,'image/jpeg');
 const meta=await sharp(output).metadata();
 assert.equal(meta.format,'jpeg');
 assert.equal(meta.width,1568);
 assert.equal(meta.height,1568);
});

test('if the JPEG fallback is still over 5 MB, view_image returns the 5 MB error',async t=>{
 const {workspace}=await tempEngine(t);
 const input=await fourColorNoisePng();
 await writeFile(join(workspace,'noisy.png'),input,{mode:0o600});
 await assert.rejects(viewImage('noisy.png',{workspace,outputLimit:1024*1024}),/5 MB|smaller/i);
});

test('Codex -i attaches the original workspace file and still rejects files over 5 MB',async t=>{
 const {engine,workspace}=await tempEngine(t);
 const input=await fourColorNoisePng();
 assert.ok(input.length<=IMAGE_LIMIT);
 await mkdir(join(workspace,'downloads'),{recursive:true,mode:0o700});
 await writeFile(join(workspace,'downloads/noisy.png'),input,{mode:0o600});
 await writeFile(join(workspace,'huge.png'),Buffer.concat([
  await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer(),
  Buffer.alloc(IMAGE_LIMIT,1),
 ]),{mode:0o600});
 const calls=[];
 const execute=async(provider,args)=>{calls.push({provider,args});return {code:0,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}})+'\n'};};
 const stub={inspect:async()=>({authenticated:true,installed:true})};
 const plans={gate:()=>({allowed:true}),view:()=>({models:[],stale:false})};
 const bridge={open:async()=>({servers:[{name:'openpikzels',url:'http://127.0.0.1/bridge',capability:'c'}],close(){},omittedSse:[]})};
 await runAgent({engine,bridge,plans,runner:stub,provider:'codex',task:'titles',brief:'describe downloads/noisy.png huge.png',origin:'http://127.0.0.1',execute});
 const attached=attachedPaths(calls.at(-1).args);
 assert.deepEqual(attached,[join(workspace,'downloads/noisy.png')]);
 const {stat}=await import('node:fs/promises');
 const info=await stat(attached[0]);
 assert.equal(info.size,input.length);
 assert.ok(info.size<=IMAGE_LIMIT);
});

test('listedImagePaths reads unquoted tokens and quoted spaced names, and ignores decoy extensions',async t=>{
 assert.deepEqual(await listedImagePaths('Analyze downloads/x.png'),['downloads/x.png']);
 assert.deepEqual(await listedImagePaths('Summarize x.png'),['x.png']);
 assert.deepEqual(await listedImagePaths('Write titles from screenshot downloads/x.png'),['downloads/x.png']);
 assert.deepEqual(await listedImagePaths('Compare x.png and y.png'),['x.png','y.png']);
 assert.deepEqual(await listedImagePaths('Make 3 thumbnails like ref.png'),['ref.png']);
 assert.deepEqual(await listedImagePaths('Caption downloads/x.png please'),['downloads/x.png']);
 assert.deepEqual(await listedFrom(t,'look at "a b.png"',['a b.png']),['a b.png']);
 assert.deepEqual(await listedImagePaths("check 'a b.png' now"),['b.png']);
 assert.deepEqual(await listedImagePaths('a b.png'),['b.png']);
 assert.deepEqual(await listedImagePaths('foo.png.exe'),[]);
 assert.deepEqual(await listedImagePaths('please open foo.png.exe'),[]);
 assert.deepEqual(await listedImagePaths('Please describe downloads/x.png'),['downloads/x.png']);
 assert.deepEqual(await listedImagePaths('describe downloads/x.png'),['downloads/x.png']);
});

test('listedImagePaths strips trailing sentence punctuation but not extra extensions',async t=>{
 assert.deepEqual(await listedImagePaths('see x.png.'),['x.png']);
 assert.deepEqual(await listedImagePaths('see x.png,'),['x.png']);
 assert.deepEqual(await listedImagePaths('Caption downloads/x.png.'),['downloads/x.png']);
 assert.deepEqual(await listedImagePaths('Compare x.png and y.png!'),['x.png','y.png']);
 assert.deepEqual(await listedFrom(t,'look at "a b.png".',['a b.png']),['a b.png']);
 assert.deepEqual(await listedImagePaths('open foo.png.exe.'),[]);
});
test('listedImagePaths ignores apostrophes, splits on semicolons, and scans non-path quotes',async t=>{
 assert.deepEqual(await listedImagePaths("Use Derrick's logo.png and don't crop"),['logo.png']);
 assert.deepEqual(await listedImagePaths("I'm sending x.png, it's the cover"),['x.png']);
 assert.deepEqual(await listedImagePaths('x.png;y.jpg'),['x.png','y.jpg']);
 assert.deepEqual(await listedFrom(t,'Derrick\'s "a b.png"',['a b.png']),['a b.png']);
 assert.deepEqual(await listedFrom(t,'look at `a b.png`',['a b.png']),['a b.png']);
 assert.deepEqual(await listedFrom(t,'please "compare x.png"',['x.png']),['x.png']);
});

test('listedImagePaths resolves quoted spans to the longest existing workspace path',async t=>{
 assert.deepEqual(await listedFrom(t,'describe "Screenshot 2026-11-10 at 7.54.00.png"',['Screenshot 2026-11-10 at 7.54.00.png']),['Screenshot 2026-11-10 at 7.54.00.png']);
 assert.deepEqual(await listedFrom(t,'"my cover photo.png"',['my cover photo.png']),['my cover photo.png']);
 assert.deepEqual(await listedFrom(t,'"Final Thumbnail.png"',['Final Thumbnail.png']),['Final Thumbnail.png']);
 assert.deepEqual(await listedFrom(t,'"foto portada.png"',['foto portada.png']),['foto portada.png']);
 assert.deepEqual(await listedFrom(t,'"describe x.png"',['x.png']),['x.png']);
});
