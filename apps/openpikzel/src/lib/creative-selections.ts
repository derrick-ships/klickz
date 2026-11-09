import {z} from "zod";
import sharp from "sharp";
import type {SupabaseClient} from "@supabase/supabase-js";
import {AppError,ownedPath} from "./validation";
import {ownedAsset} from "./assets";
import {youtubeVideoId} from "./video-context";
export const creativeSelectionShape={personaId:z.string().uuid().optional(),styleId:z.string().uuid().optional(),referencePaths:z.array(z.string().max(400)).max(6).default([]),includeReferences:z.boolean().default(false),videoUrl:z.string().trim().max(500).default("")};
type Input={personaId?:string;styleId?:string;referencePaths:string[];includeReferences:boolean;videoUrl:string;task:"chat"|"enhance"};
export async function creativeSelections(db:SupabaseClient,userId:string,input:Input){
 const paths=[...input.referencePaths],profiles:{kind:string;name:string;notes:string;brief:string;referenceCount:number}[]=[];
 if(paths.some(path=>!ownedPath(path,userId)))throw new AppError(403,"Choose references from your own library.");
 if(input.videoUrl)youtubeVideoId(input.videoUrl);
 for(const [table,id,kind]of [["studio_personas",input.personaId,"persona"],["studio_styles",input.styleId,"style"]]as const){
  if(!id)continue;const result=await db.from(table).select("id,name,notes,identity_brief,refs").eq("id",id).eq("user_id",userId).maybeSingle();if(result.error||!result.data)throw new AppError(404,"This selected profile is not available in your account.");
  const row=result.data,refs=Array.isArray(row.refs)?row.refs.slice(0,3):[];if(refs.some(path=>typeof path!=="string"||!ownedPath(path,userId)))throw new AppError(403,"This profile contains an unavailable reference.");paths.push(...refs);
  profiles.push({kind,name:String(row.name||"").slice(0,80),notes:String(row.notes||"").slice(0,800),brief:String(row.identity_brief||"").slice(0,2400),referenceCount:refs.length});
 }
 const unique=[...new Set(paths)],selected=input.includeReferences&&input.task==="chat"?unique.slice(0,2):[],images=await Promise.all(selected.map(async path=>sharp(await ownedAsset(db,userId,path),{limitInputPixels:40000000}).rotate().resize({width:768,height:768,fit:"inside",withoutEnlargement:true}).jpeg({quality:80}).toBuffer()));
 return {images,context:{version:"studio-context-1",profiles,selectedReferenceCount:unique.length,referenceImagesAttached:images.length,referenceNotice:images.length?"Only the first two selected reference/profile images at most are attached. Other reference images were not viewed.":"Reference images are not attached; profile briefs are text context only.",video:input.videoUrl?{url:input.videoUrl,availability:"link-only",notice:"This video link was not fetched or watched for this conversation. Do not claim to know its contents."}:null}};
}
