import { z } from "zod";
import { AppError } from "./validation";
// Codex's public OAuth client, also used by the referenced DSH/pi integration.
// This is the Codex device flow, not a registered OpenPikzels website OAuth client.
const clientId = "app_EMoamEEZ73f0CkXaXp7hrann";
const authBase = "https://auth.openai.com";
export const verificationUrl = authBase + "/codex/device";
export type CodexCredential = { access: string; refresh: string; expires: number; accountId: string; label: string; plan?: string };
export type DeviceGrant = { deviceId: string; userCode: string; interval: number };
const tokenSchema = z.object({ access_token: z.string().min(10).max(12000), refresh_token: z.string().min(1).max(12000), expires_in: z.number().positive().max(2592000) });
async function boundedJson(response: Response) {
 const reader=response.body?.getReader(); if(!reader) throw new AppError(502,"OpenAI returned an empty response.");
 let text="",size=0; const decoder=new TextDecoder();
 try { while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>256000)throw new AppError(502,"OpenAI returned an unexpected response.");text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return JSON.parse(text); }
 catch { throw new AppError(502,"OpenAI returned an unexpected response."); } finally { await reader.cancel().catch(()=>{}); }
}
async function request(url:string, init:RequestInit={}) {
 try { return await fetch(url,{...init,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000)}); }
 catch { throw new AppError(502,"Could not reach OpenAI. Try again."); }
}
function jsonPost(value:unknown):RequestInit{return{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)};}
export async function startDevice():Promise<DeviceGrant>{
 const r=await request(authBase+"/api/accounts/deviceauth/usercode",jsonPost({client_id:clientId}));
 if(!r.ok)throw new AppError(r.status===429?429:502,"OpenAI could not start device sign-in. Check device-code login in your ChatGPT security settings and try again.");
 const d=z.object({device_auth_id:z.string().min(1).max(2000),user_code:z.string().min(4).max(64),interval:z.union([z.string(),z.number()])}).safeParse(await boundedJson(r));
 if(!d.success)throw new AppError(502,"OpenAI returned an unexpected sign-in response.");
 const interval=Number(d.data.interval); if(!Number.isFinite(interval)||interval<0||interval>300)throw new AppError(502,"OpenAI returned an unexpected polling interval.");
 return{deviceId:d.data.device_auth_id,userCode:d.data.user_code,interval:Math.max(5,Math.ceil(interval))};
}
export async function pollDevice(grant:DeviceGrant):Promise<{kind:"pending"|"slow"}|{kind:"authorized";code:string;verifier:string}>{
 const r=await request(authBase+"/api/accounts/deviceauth/token",jsonPost({device_auth_id:grant.deviceId,user_code:grant.userCode}));
 if(r.status===403||r.status===404)return{kind:"pending"};
 if(r.status===429)return{kind:"slow"};
 const body=await boundedJson(r);
 if(!r.ok){const code=typeof body?.error==="string"?body.error:body?.error?.code;
  if(code==="deviceauth_authorization_pending")return{kind:"pending"};
  if(code==="slow_down"||r.status===429)return{kind:"slow"};
  throw new AppError(400,"OpenAI did not complete sign-in. Cancel this attempt and connect again.");
 }
 const d=z.object({authorization_code:z.string().min(1).max(8000),code_verifier:z.string().min(16).max(512)}).safeParse(body);
 if(!d.success)throw new AppError(502,"OpenAI returned an unexpected authorization response.");
 return{kind:"authorized",code:d.data.authorization_code,verifier:d.data.code_verifier};
}
export function credentialFromToken(value:unknown):CodexCredential{
 const token=tokenSchema.safeParse(value); if(!token.success)throw new AppError(502,"OpenAI did not return a usable connection.");
 let claims;try{claims=JSON.parse(Buffer.from(token.data.access_token.split(".")[1],"base64url").toString("utf8"));}catch{throw new AppError(502,"OpenAI did not return account details.");}
 const account=claims?.["https://api.openai.com/auth"], profile=claims?.["https://api.openai.com/profile"];
 const accountId=account?.chatgpt_account_id;
 if(typeof accountId!=="string"||accountId.length<1||accountId.length>200)throw new AppError(502,"OpenAI did not return account details.");
 const email=typeof profile?.email==="string"?profile.email:typeof claims?.email==="string"?claims.email:"";
 const label=email.includes("@")?email.slice(0,1)+"•••@"+email.split("@").at(-1):"ChatGPT account";
 return{access:token.data.access_token,refresh:token.data.refresh_token,expires:Date.now()+token.data.expires_in*1000,accountId,label,plan:typeof account?.chatgpt_plan_type==="string"?account.chatgpt_plan_type.slice(0,40):undefined};
}
async function tokens(fields:Record<string,string>){
 const r=await request(authBase+"/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...fields,client_id:clientId})});
 if(!r.ok)throw new AppError(401,"OpenAI authorization could not be completed. Connect your ChatGPT account again.");
 return credentialFromToken(await boundedJson(r));
}
export const exchangeDevice=(code:string,verifier:string)=>tokens({grant_type:"authorization_code",code,code_verifier:verifier,redirect_uri:authBase+"/deviceauth/callback"});
export const refreshCredential=(refresh:string)=>tokens({grant_type:"refresh_token",refresh_token:refresh});
export async function readCodex(credential:CodexCredential,kind:"usage"|"models"){
 const path=kind==="usage"?"/wham/usage":"/codex/models?client_version=0.167.0";
 const r=await request("https://chatgpt.com/backend-api"+path,{headers:{Authorization:"Bearer "+credential.access,"chatgpt-account-id":credential.accountId,Accept:"application/json"}});
 if(!r.ok)throw new AppError(r.status===401?401:r.status===429?429:502,kind==="usage"?"OpenAI usage is unavailable.":"OpenAI models are unavailable.");
 return boundedJson(r);
}
export function normalizeUsage(raw:unknown){
 const value=raw as Record<string,any>|null; const windows:{kind:string;usedPercent?:number;resetsAt?:number}[]=[];
 const add=(w:any)=>{if(!w||typeof w!=="object")return;const duration=w.limit_window_seconds;const kind=typeof duration==="number"?(duration<=86400?"session":duration<=604800?"weekly":"monthly"):"window";
 const used=typeof w.used_percent==="number"&&Number.isFinite(w.used_percent)?Math.min(100,Math.max(0,w.used_percent)):undefined;
 const reset=typeof w.reset_at==="number"&&Number.isFinite(w.reset_at)?w.reset_at:undefined;if(used!==undefined||reset!==undefined)windows.push({kind,usedPercent:used,resetsAt:reset});};
 add(value?.rate_limit?.primary_window);add(value?.rate_limit?.secondary_window);
 return windows;
}
export function normalizeModels(raw:unknown){
 const models=(raw as {models?:unknown[]})?.models;if(!Array.isArray(models))return[];
 return models.flatMap((entry:any)=>{const id=entry?.slug??entry?.id;if(typeof id!=="string"||!/^[\w.:-]{1,150}$/.test(id)||entry?.visibility==="hidden")return[];return[{id,name:typeof entry.display_name==="string"?entry.display_name.slice(0,100):id}];}).slice(0,100);
}
