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

const BRIEF_WORDS=new Set('please describe look see check open view attach use the this that these those my your its of in on at to for and or with from into over under file image files images path paths named called is are was here there now'.split(' '));

export function listedImagePaths(brief){
 const text=String(brief);
 const found=[];
 const seen=new Set();
 const add=value=>{
  const path=value.trim();
  if(!path||seen.has(path))return;
  seen.add(path);
  found.push(path);
 };
 const quoted=/(["'`])([^"'`\n]*?\.(?:png|jpe?g|webp))\1(?![A-Za-z0-9._-])/gi;
 for(const match of text.matchAll(quoted))add(match[2]);
 const ext=/\.(?:png|jpe?g|webp)(?![A-Za-z0-9._-])/gi;
 for(const match of text.matchAll(ext)){
  const end=match.index+match[0].length;
  let i=match.index;
  while(i>0&&/[\w./-]/.test(text[i-1]))i--;
  while(i>0&&text[i-1]===' '){
   let j=i-1;
   while(j>0&&text[j-1]===' ')j--;
   if(j===0||!/[\w./-]/.test(text[j-1]))break;
   const tokenEnd=j;
   while(j>0&&/[\w./-]/.test(text[j-1]))j--;
   const token=text.slice(j,tokenEnd);
   if(BRIEF_WORDS.has(token.toLowerCase()))break;
   i=j;
  }
  if(i>0&&!/[\s"'`(\[{<,;:]/.test(text[i-1]))continue;
  add(text.slice(i,end));
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
 for(const path of listedImagePaths(brief)){
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
