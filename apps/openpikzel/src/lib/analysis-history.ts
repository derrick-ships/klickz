import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import {AppError} from "./validation";
import {pillars,type Evaluation} from "./types";
import {verifyDiagnostic} from "./diagnostic-proof";
import {ownedAsset} from "./assets";
import {digest} from "./diagnostics";
const cursorSchema=z.object({at:z.string().datetime({offset:true}),id:z.string().uuid()});
const dimension=z.object({score:z.number().min(0).max(100).nullable(),confidence:z.number().min(0).max(1),observation:z.string().max(1500),strength:z.string().max(1500),weakness:z.string().max(1500),fix:z.string().max(1500)});
const scoreSchema=z.object({source:z.literal("jev"),version:z.union([z.literal(2),z.literal(3)]),title:z.string().max(100),overall:z.number().min(0).max(100).nullable(),note:z.string().max(4000),priority:z.enum(pillars),created_at:z.string().datetime({offset:true}),dimensions:z.object(Object.fromEntries(pillars.map(p=>[p,dimension])) as Record<(typeof pillars)[number],typeof dimension>),proof:z.string().max(32000).optional(),sourceDigest:z.string().regex(/^[a-f0-9]{64}$/).optional()});
export function readAnalysisCursor(raw?:string|null){if(!raw)return null;try{if(raw.length>512)throw Error();return cursorSchema.parse(JSON.parse(Buffer.from(raw,"base64url").toString()));}catch{throw new AppError(400,"This history cursor is invalid. Open the history again.");}}
export async function analysisHistory(db:SupabaseClient,userId:string,creationId:string,rawCursor?:string|null){
 if(!z.string().uuid().safeParse(creationId).success)throw new AppError(400,"Choose a thumbnail to view its history.");
 const cursor=readAnalysisCursor(rawCursor);
 const owned=await db.from("studio_creations").select("id,image_path").eq("id",creationId).eq("user_id",userId).maybeSingle();
 if(owned.error)throw owned.error;if(!owned.data)throw new AppError(404,"This thumbnail is not available in your account.");
 const currentDigest=owned.data.image_path?digest(await ownedAsset(db,userId,owned.data.image_path)):null;
 let query=db.from("studio_jobs").select("id,created_at,result").eq("user_id",userId).eq("operation","analyze").eq("state","succeeded").eq("result->>creationId",creationId);
 if(cursor)query=query.or("created_at.lt."+cursor.at+",and(created_at.eq."+cursor.at+",id.lt."+cursor.id+")");
 const result=await query.order("created_at",{ascending:false}).order("id",{ascending:false}).limit(21);
 if(result.error)throw result.error;
 const rows=(result.data||[]).slice(0,20),analyses=rows.map(row=>{
  const value=row.result?.score;if(!scoreSchema.safeParse(value).success)return{id:row.id,createdAt:row.created_at,unavailable:true};
  const score=value as Evaluation;let verified=false;try{verifyDiagnostic(score);verified=true;}catch{/* Historical records remain viewable, with an explicit verification warning. */}
  return{id:row.id,createdAt:row.created_at,score,verified,matchesCurrentImage:score.sourceDigest&&currentDigest?score.sourceDigest===currentDigest:null};
 });
 const last=rows.at(-1),nextCursor=result.data&&result.data.length>20&&last?Buffer.from(JSON.stringify(cursorSchema.parse({at:last.created_at,id:last.id}))).toString("base64url"):null;
 return {analyses,nextCursor,notice:"Saved analysis versions are read-only. Viewing history does not score an image, change its title or create a fix."};
}
