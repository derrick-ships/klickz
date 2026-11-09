import {creativeSelectionShape,creativeSelections} from "@/lib/creative-selections";
import {z} from "zod";
import sharp from "sharp";
import {authenticated,failure,requireAI,withUserProviders} from "@/lib/server";
import {AppError} from "@/lib/validation";
import {ownedAsset} from "@/lib/assets";
import {reserveJob,updateJob,ambiguousProviderError} from "@/lib/jobs";
import {enhancePrompt,structuredCreativeText,conversationInstructions,chatReplySchema} from "@/lib/creative-text";
import {instructionVersion} from "@/lib/instructions";
export const maxDuration=60;
const inputSchema=z.object({
 ...creativeSelectionShape,
 task:z.enum(["enhance","chat"]),provider:z.enum(["openai","google"]),modelChoice:z.enum(["economy","standard"]).default("economy"),
 requestId:z.string().uuid(),conversationId:z.string().uuid().optional(),creationId:z.string().uuid().optional(),
 direction:z.string().max(2400).default(""),prompt:z.string().trim().min(1).max(2400),title:z.string().max(100).default(""),mode:z.enum(["generate","edit","recreate","title","analyze"]).default("generate"),format:z.enum(["long","short"]).default("long"),
 history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(4000)})).max(12).default([])
}).refine(input=>input.task!=="enhance"||input.prompt.length>=8,{message:"Use at least eight characters for prompt enhancement."});
async function handle(request:Request){
 let context:Awaited<ReturnType<typeof authenticated>>|undefined,jobId:string|undefined,dispatched=false;
 try{
  context=await authenticated(request);const {db,user}=context,input=inputSchema.parse(await request.json());requireAI(input.provider);
  let project:unknown=null,source:unknown=null;const images:Buffer[]=[];
  if(input.conversationId){const r=await db.from("studio_conversations").select("id,title").eq("id",input.conversationId).eq("user_id",user.id).maybeSingle();if(r.error||!r.data)throw new AppError(404,"This project is not available in your account.");project={id:r.data.id,title:String(r.data.title||"").slice(0,100)};}
  if(input.creationId){const r=await db.from("studio_creations").select("id,title,image_path,prompt,score").eq("id",input.creationId).eq("user_id",user.id).maybeSingle();if(r.error||!r.data)throw new AppError(404,"This thumbnail is not available in your account.");const row=r.data;source={id:row.id,title:String(row.title||"").slice(0,100),prompt:String(row.prompt||"").slice(0,2400),score:row.score?{overall:typeof row.score.overall==="number"?row.score.overall:null,dimensions:Object.fromEntries(["virality","clarity","idea","curiosity","emotion"].map(p=>[p,{score:typeof row.score.dimensions?.[p]?.score==="number"?row.score.dimensions[p].score:null,observation:String(row.score.dimensions?.[p]?.observation||"").slice(0,400)}]))}:null};if(input.task==="chat"&&row.image_path)images.push(await sharp(await ownedAsset(db,user.id,row.image_path),{limitInputPixels:40000000}).rotate().resize({width:768,height:768,fit:"inside",withoutEnlargement:true}).jpeg({quality:80}).toBuffer());}
  const selections=await creativeSelections(db,user.id,input);
  if(input.task==="chat")images.push(...selections.images);
  const payload={...input,project,source,selectionContext:selections.context,instructionVersion};
  // Replay identity follows the submitted intent; owned project/source context can change after completion.
  const reserved=await reserveJob(db,user.id,input.requestId,"generate",{kind:"creative-text",...input},1);
  if(reserved.replay)return Response.json(reserved.replay);
  jobId=input.requestId;await updateJob(db,user.id,jobId,"running");dispatched=true;
  const result=input.task==="enhance"?await enhancePrompt(input,selections.context):await structuredCreativeText(input.provider,conversationInstructions,payload,input.modelChoice,images);
  const value=input.task==="enhance"?result.value:chatReplySchema.parse(result.value);
  const response={kind:input.task==="enhance"?"prompt-enhancement":"creative-chat",...result,value,jobId};
  await updateJob(db,user.id,jobId,"succeeded",response);return Response.json(response);
 }catch(error){if(context&&jobId)await updateJob(context.db,context.user.id,jobId,dispatched&&ambiguousProviderError(error)?"reconciling":"failed").catch(()=>{});return failure(error);}
}
export const POST=(request:Request)=>withUserProviders(request,()=>handle(request),["studio:ai","studio:write"]);
