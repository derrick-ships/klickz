import {z} from "zod";
import {authenticated,failure} from "@/lib/server";
import {sameOrigin} from "@/lib/crypto";
import {limitedJson} from "@/lib/oauth/http";
import {AppError} from "@/lib/validation";
import {codexStatus,beginCodex,pollCodex,checkCodex,transition} from "@/lib/codex-connection";
export const runtime="nodejs";
export const maxDuration=60;
const headers={"Cache-Control":"no-store","Pragma":"no-cache"};
async function context(request:Request){
 if(process.env.CODEX_DEVICE_ENABLED!=="true")throw new AppError(503,"Codex device sign-in is not enabled.");
 const c=await authenticated(request);if(c.oauth)throw new AppError(403,"Manage your ChatGPT connection directly in the app.");return c;
}
export async function GET(request:Request){try{const{db,user}=await context(request);return Response.json(await codexStatus(db,user.id),{headers});}catch(e){const r=failure(e);r.headers.set("Cache-Control","no-store");return r;}}
export async function POST(request:Request){
 try{
  sameOrigin(request);const{db,user}=await context(request);
  const input=z.discriminatedUnion("action",[z.object({action:z.literal("start")}).strict(),z.object({action:z.literal("poll"),attemptId:z.string().uuid()}).strict(),z.object({action:z.literal("cancel"),attemptId:z.string().uuid()}).strict(),z.object({action:z.literal("check")}).strict()]).parse(await limitedJson(request,2000));
  const result=input.action==="start"?await beginCodex(db,user.id):input.action==="poll"?await pollCodex(db,user.id,input.attemptId):input.action==="check"?await checkCodex(db,user.id):await(async()=>{await transition(db,"cancel",input.attemptId);return codexStatus(db,user.id);})();
  return Response.json(result,{headers});
 }catch(e){const r=failure(e);r.headers.set("Cache-Control","no-store");return r;}
}
export async function DELETE(request:Request){try{sameOrigin(request);const{db,user}=await context(request);await transition(db,"disconnect");return Response.json({connected:false,phase:"idle"},{headers});}catch(e){const r=failure(e);r.headers.set("Cache-Control","no-store");return r;}}
