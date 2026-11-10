import {readFile,realpath,stat} from 'node:fs/promises';
import {extname,isAbsolute,join,resolve,sep} from 'node:path';

export const IMAGE_LIMIT=5*1024*1024;
const MIME={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const FORMATS=new Set(['png','jpeg','webp']);

export const visionToolDefinitions=[
 {name:'view_image',description:'View a PNG, JPEG or WebP image from the agent workspace. Paths outside the workspace are rejected.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}}
];

export async function resolveWorkspaceFile(workspace,inputPath){
 if(typeof inputPath!=='string'||!inputPath.trim())throw new Error('Choose an image inside the agent workspace.');
 if(inputPath.includes('\0'))throw new Error('Images must stay in the workspace folder.');
 const root=await realpath(workspace);
 const candidate=resolve(isAbsolute(inputPath)?inputPath:join(root,inputPath));
 if(candidate!==root&&!candidate.startsWith(root+sep))throw new Error('Images must stay in the workspace folder.');
 let resolved;
 try{resolved=await realpath(candidate);}catch{throw new Error('The image could not be read.');}
 if(resolved!==root&&!resolved.startsWith(root+sep))throw new Error('Images must stay in the workspace folder.');
 return resolved;
}

const IMAGE_PATH=/^(?:[\w./-]+(?: +[\w./-]+)*)\.(?:png|jpe?g|webp)$/i;

function trimPathPunctuation(value){
 return String(value).replace(/^['({[<]+/,'').replace(/['.,;:!?)}\]>]+$/,'').trim();
}

function imagePathFrom(value){
 const path=trimPathPunctuation(value);
 return IMAGE_PATH.test(path)?path:'';
}

function tokensAt(text,base=0){
 const found=[];
 for(const match of text.matchAll(/[^\s;]+/g))found.push({value:match[0],index:base+match.index});
 return found;
}

function wordSpans(inner){
 const trimmed=trimPathPunctuation(inner);
 const trimAt=trimmed?inner.indexOf(trimmed):0;
 const spans=[];
 if(!trimmed)return {trimmed,spans};
 let cursor=0;
 for(const word of trimmed.split(/\s+/).filter(Boolean)){
  const at=trimmed.indexOf(word,cursor);
  spans.push({word,start:trimAt+at});
  cursor=at+word.length;
 }
 return {trimmed,spans};
}

export async function listedImagePaths(brief,{workspace,resolveImage=resolveWorkspaceImage}={}){
 const text=String(brief);
 const hits=[];
 const add=(value,index)=>{
  const path=imagePathFrom(value);
  if(!path)return;
  hits.push({path,index});
 };
 const addResolved=(path,index)=>{
  if(!path)return;
  hits.push({path,index});
 };
 async function longestQuotedPath(inner){
  const {trimmed,spans}=wordSpans(inner);
  if(!trimmed||!spans.length)return {path:'',spans,from:-1};
  if(!workspace)return {path:'',spans,from:-1};
  for(let i=0;i<spans.length;i++){
   const candidate=spans.slice(i).map(span=>span.word).join(' ');
   try{
    await resolveImage(workspace,candidate);
    return {path:candidate,spans,from:i};
   }catch{}
  }
  return {path:'',spans,from:-1};
 }
 let last=0;
 const quoted=/(["`])([^"`\n]*)\1/g;
 for(const match of text.matchAll(quoted)){
  const base=match.index+match[1].length;
  for(const token of tokensAt(text.slice(last,match.index),last))add(token.value,token.index);
  const {path,spans,from}=await longestQuotedPath(match[2]);
  if(path)addResolved(path,base+spans[from].start);
  const leftover=from>=0?spans.slice(0,from):spans;
  for(const span of leftover)add(span.word,base+span.start);
  last=match.index+match[0].length;
 }
 for(const token of tokensAt(text.slice(last),last))add(token.value,token.index);
 hits.sort((a,b)=>a.index-b.index);
 const found=[];
 const seen=new Set();
 for(const hit of hits){
  if(seen.has(hit.path))continue;
  seen.add(hit.path);
  found.push(hit.path);
 }
 return found;
}

export async function resolveWorkspaceImage(workspace,inputPath){
 const resolved=await resolveWorkspaceFile(workspace,inputPath);
 const ext=extname(resolved).toLowerCase();
 if(!MIME[ext])throw new Error('Use a PNG, JPEG or WebP image.');
 const info=await stat(resolved);
 if(info.size>IMAGE_LIMIT)throw new Error('Images must be 5 MB or smaller.');
 return resolved;
}

export async function workspaceImages(workspace,brief){
 const files=[];
 for(const path of await listedImagePaths(brief,{workspace})){
  try{files.push(await resolveWorkspaceImage(workspace,path));}catch{}
 }
 return files;
}

async function defaultLoadSharp(){
 return import('sharp');
}

async function readWorkspaceImage(path,{workspace,loadSharp=defaultLoadSharp,outputLimit=IMAGE_LIMIT}={}){
 const resolved=await resolveWorkspaceImage(workspace,path);
 const bytes=await readFile(resolved);
 if(bytes.length>IMAGE_LIMIT)throw new Error('Images must be 5 MB or smaller.');
 let sharp;
 try{
  const loaded=await loadSharp();
  sharp=loaded?.default||loaded;
  if(typeof sharp!=='function')throw new Error('unavailable');
 }catch{
  throw new Error('Image processing is unavailable.');
 }
 try{
  const image=sharp(bytes,{limitInputPixels:40000000}).rotate().resize(1568,1568,{fit:'inside',withoutEnlargement:true});
  const meta=await image.metadata();
  if(!FORMATS.has(meta.format))throw new Error('Use a PNG, JPEG or WebP image.');
  let data=await image.toBuffer();
  let mimeType=meta.format==='jpeg'?'image/jpeg':meta.format==='webp'?'image/webp':'image/png';
  if(data.length>outputLimit){
   data=await sharp(data).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
   mimeType='image/jpeg';
   if(data.length>outputLimit)throw new Error('Images must be 5 MB or smaller.');
  }
  return {content:[{type:'image',data:data.toString('base64'),mimeType}]};
 }catch(error){
  if(error instanceof Error&&/PNG, JPEG or WebP|unavailable|5 MB|smaller/i.test(error.message))throw error;
  throw new Error('The image could not be read.');
 }
}

export async function viewImage(path,{workspace,workspaces,loadSharp=defaultLoadSharp,outputLimit}={}){
 const roots=[...new Set((workspaces&&workspaces.length?workspaces:[workspace]).filter(Boolean))];
 if(!roots.length)throw new Error('Choose an image inside the agent workspace.');
 let last;
 for(const root of roots){
  try{return await readWorkspaceImage(path,{workspace:root,loadSharp,outputLimit});}
  catch(error){
   last=error;
   if(!/could not be read/i.test(error.message))throw error;
  }
 }
 throw last;
}

export async function callVisionTool(name,args,{workspace,workspaces,loadSharp}={}){
 if(name==='view_image')return viewImage(args.path,{workspace,workspaces,loadSharp});
 throw new Error('Unsupported host tool.');
}
