import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seal,unseal } from "./crypto";
import { AppError } from "./validation";
import { startDevice,pollDevice,exchangeDevice,refreshCredential,readCodex,normalizeUsage,normalizeModels,verificationUrl,type CodexCredential,type DeviceGrant } from "./codex-provider";
export type CodexRow={user_id:string;credential_ciphertext:string|null;credential_version:string;needs_reauth:boolean;attempt_id:string|null;phase:string;pending_ciphertext:string|null;expires_at:string|null;poll_interval:number;next_poll_at:string|null;credential_lease:string|null};
const purpose=(uid:string)=>"codex:"+uid;
async function read(db:SupabaseClient,uid:string):Promise<CodexRow|null>{
 const r=await db.from("studio_codex_connections").select("*").eq("user_id",uid).maybeSingle();
 if(r.error)throw new AppError(503,"Codex connection storage is unavailable.");return r.data;
}
export async function transition(db:SupabaseClient,action:string,id:string|null=null,lease:string|null=null,ciphertext:string|null=null,wait=5):Promise<CodexRow|null>{
 const r=await db.rpc("studio_codex_transition",{p_action:action,p_id:id,p_lease:lease,p_ciphertext:ciphertext,p_wait:wait});
 if(r.error)throw new AppError(503,"Could not update your Codex connection.");return r.data?.[0]??null;
}
export function publicCodexStatus(row:CodexRow|null,uid:string){
 if(!row)return{connected:false,phase:"idle"};
 const credential=row.credential_ciphertext?unseal<CodexCredential>(row.credential_ciphertext,purpose(uid)):null;
 const expired=!!row.attempt_id&&!!row.expires_at&&Date.parse(row.expires_at)<=Date.now();
 const pending=!expired&&row.pending_ciphertext?unseal<DeviceGrant>(row.pending_ciphertext,purpose(uid)+":device"):null;
 return{connected:!!credential&&!row.needs_reauth,needsReauth:row.needs_reauth,phase:expired?"expired":row.phase,
  label:credential?.label,plan:credential?.plan,
  ...(row.attempt_id&&!expired?{attemptId:row.attempt_id,expiresAt:row.expires_at,pollAfter:Math.max(row.poll_interval,Math.ceil((Date.parse(row.next_poll_at||"")-Date.now())/1000)||0),
    ...(pending?{userCode:pending.userCode,verificationUrl}:{} )}:{})};
}
export async function codexStatus(db:SupabaseClient,uid:string){return publicCodexStatus(await read(db,uid),uid);}
export async function beginCodex(db:SupabaseClient,uid:string){
 const id=randomUUID();
 if(!await transition(db,"begin",id))throw new AppError(429,"Wait 30 seconds before starting another sign-in.");
 try{
  const device=await startDevice();
  const saved=await transition(db,"ready",id,null,seal(device,purpose(uid)+":device"),device.interval);
  if(!saved)throw new AppError(409,"This sign-in was cancelled or replaced.");
  return publicCodexStatus(saved,uid);
 }catch(e){await transition(db,"fail",id).catch(()=>{});throw e;}
}
export async function pollCodex(db:SupabaseClient,uid:string,id:string){
 const lease=randomUUID(),row=await transition(db,"claim",id,lease);
 if(!row)return codexStatus(db,uid);
 const grant=unseal<DeviceGrant>(row.pending_ciphertext!,purpose(uid)+":device");
 let result;
 try{result=await pollDevice(grant);}catch(e){
  // Network errors during polling are safe to retry. Token exchange below is not.
  await transition(db,"pending",id,lease,null,row.poll_interval).catch(()=>{});throw e;
 }
 if(result.kind!=="authorized"){
  await transition(db,"pending",id,lease,null,result.kind==="slow"?Math.min(300,row.poll_interval+5):row.poll_interval);
  return codexStatus(db,uid);
 }
 if(!await transition(db,"exchange",id,lease))return codexStatus(db,uid);
 try{
  const credential=await exchangeDevice(result.code,result.verifier);
  const saved=await transition(db,"finish",id,lease,seal(credential,purpose(uid)));
  if(!saved)throw new AppError(409,"Sign-in was cancelled, replaced or expired. No connection was saved.");
  return publicCodexStatus(saved,uid);
 }catch(e){await transition(db,"fail",id).catch(()=>{});throw e;}
}
export async function codexCredential(db:SupabaseClient,uid:string){
 const row=await read(db,uid);
 if(!row?.credential_ciphertext||row.needs_reauth)throw new AppError(401,"Connect your ChatGPT account again.");
 const current=unseal<CodexCredential>(row.credential_ciphertext,purpose(uid));
 if(current.expires>Date.now()+60000)return current;
 const lease=randomUUID(),locked=await transition(db,"refresh_claim",null,lease);
 if(!locked)throw new AppError(409,"Your connection is refreshing or needs sign-in. Refresh its status.");
 try{
  const before=unseal<CodexCredential>(locked.credential_ciphertext!,purpose(uid));
  const next=before.expires>Date.now()+60000?before:await refreshCredential(before.refresh);
  if(next.accountId!==before.accountId)throw new AppError(401,"The OpenAI account changed. Sign in again.");
  const saved=await transition(db,"refresh_finish",locked.credential_version,lease,seal(next,purpose(uid)));
  if(!saved||saved.needs_reauth)throw new AppError(409,"Your connection changed. Refresh its status.");
  return next;
 }catch(e){await transition(db,"refresh_fail",locked.credential_version,lease).catch(()=>{});throw e;}
}
export async function checkCodex(db:SupabaseClient,uid:string){
 const credential=await codexCredential(db,uid);
 const results=await Promise.allSettled([readCodex(credential,"usage"),readCodex(credential,"models")]);
 // Readings are returned to the current browser only, never persisted.
 return{...await codexStatus(db,uid),checkedAt:new Date().toISOString(),
  windows:results[0].status==="fulfilled"?normalizeUsage(results[0].value):[],
  usageAvailable:results[0].status==="fulfilled",
  models:results[1].status==="fulfilled"?normalizeModels(results[1].value):[],
  modelsAvailable:results[1].status==="fulfilled"};
}
