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

export function listedImagePaths(brief){
 const found=String(brief).match(/(?:^|[\s"'`])((?:[\w./-])+?\.(?:png|jpe?g|webp))\b/gi)||[];
 return [...new Set(found.map(value=>value.replace(/^[ \t"'`]+/,'')))];
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

async function readWorkspaceImage(path,{workspace,loadSharp=defaultLoadSharp}={}){
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
  const data=await image.toBuffer();
  return {content:[{type:'image',data:data.toString('base64'),mimeType:meta.format==='jpeg'?'image/jpeg':meta.format==='webp'?'image/webp':'image/png'}]};
 }catch(error){
  if(error instanceof Error&&/PNG, JPEG or WebP|unavailable/i.test(error.message))throw error;
  throw new Error('The image could not be read.');
 }
}

export async function viewImage(path,{workspace,workspaces,loadSharp=defaultLoadSharp}={}){
 const roots=[...new Set((workspaces&&workspaces.length?workspaces:[workspace]).filter(Boolean))];
 if(!roots.length)throw new Error('Choose an image inside the agent workspace.');
 let last;
 for(const root of roots){
  try{return await readWorkspaceImage(path,{workspace:root,loadSharp});}
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
