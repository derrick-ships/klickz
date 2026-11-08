import {z} from 'zod/v3';
import {randomUUID} from 'node:crypto';
const optional=s=>z.preprocess(v=>v===null?undefined:v,s.optional());
const array=s=>z.preprocess(v=>{if(typeof v==='string'){try{return JSON.parse(v);}catch{}}return v;},z.array(s).min(1).max(20));
const text=z.string().trim().min(1).max(2000),key=z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),url=z.string().url().max(2000);
export const schemas={
 ask_user:z.object({questions:array(z.object({question:text,header:optional(z.string().max(30)),options:optional(array(text)),multiple:optional(z.boolean())}))}),
 request_approval:z.object({approvals:array(z.object({action:text,detail:optional(text)}))}),
 request_secret:z.object({secrets:array(z.object({key,label:text,help:optional(text),docsUrl:optional(url)})),reason:optional(text)}),
 suggest_service:z.object({services:array(z.object({name:text,reason:text,url:optional(url)}))}),
 request_mcp_sign_in:z.object({name:text,reason:optional(text)}),
 request_takeover:z.object({url,reason:text}),
 notify:z.object({level:z.enum(['info','progress','done','error']),message:text})
};
export const HITL_CANCELLED={
 ask_user:'[User dismissed the questions without answering]',
 request_approval:'[User declined the requested approvals]',
 request_secret:'[User skipped the requested secrets]',
 suggest_service:'[User dismissed the service suggestions]',
 request_mcp_sign_in:'[User declined MCP sign-in]',
 request_takeover:'[User declined browser takeover]'
};
export const toolDefinitions=Object.entries(schemas).map(([name,schema])=>({name,description:name==='notify'?'Send a non-blocking progress update.':'Deliver one human-in-the-loop card and end this turn. Do not call more tools until the user replies.',inputSchema:zodSchema(schema)}));
function zodSchema(s){const type=s._def.typeName;if(type==='ZodObject')return {type:'object',properties:Object.fromEntries(Object.entries(s.shape).map(([k,v])=>[k,zodSchema(v)])),required:Object.entries(s.shape).filter(([,v])=>!v.isOptional()).map(([k])=>k)};
 if(type==='ZodEffects')return zodSchema(s._def.schema);if(type==='ZodOptional')return zodSchema(s._def.innerType);if(type==='ZodArray')return {type:'array',items:zodSchema(s._def.type)};if(type==='ZodBoolean')return {type:'boolean'};if(type==='ZodEnum')return {type:'string',enum:s._def.values};return {type:'string'};}
export function validateCall(name,input){if(!Object.hasOwn(schemas,name))throw new Error('Unknown card tool.');return schemas[name].parse(input);}
export function findPending(messages){
 for(let i=messages.length-1;i>=0;i--){const call=messages[i].call;if(!call||!HITL_CANCELLED[call.name])continue;
  if(messages.slice(i+1).some(m=>(m.role==='tool'&&m.callId===call.id&&m.isError)||(m.role==='user'&&m.replyTo===call.id)))continue;
  try{validateCall(call.name,call.input);return call;}catch{}
 }return null;
}
const marker='\n\n<!-- openpikzels-answer:';
export function serializeAnswers(value){const safe=JSON.stringify(value);const visible=(value.answers||[]).map(x=>'**'+x.question+'**\n'+x.answer).join('\n\n')||(value.secrets||[]).map(x=>x.key+': '+x.status).join('\n')||value.message||'Response submitted.';return visible+marker+Buffer.from(safe).toString('base64url')+' -->';}
export function parseReply(text){const at=text.lastIndexOf(marker);if(at<0)return null;try{return JSON.parse(Buffer.from(text.slice(at+marker.length).split(' -->')[0],'base64url').toString());}catch{return null;}}
export function answerMessage(messages,id,value){
 const call=findPending(messages);if(!call||call.id!==id)throw new Error('This card is no longer pending.');
 return {id:randomUUID(),role:'user',replyTo:id,content:value.dismiss?HITL_CANCELLED[call.name]:serializeAnswers(value),at:Date.now()};
}
export async function submitSecrets(messages,id,values,vault){
 const call=findPending(messages);if(!call||call.id!==id||call.name!=='request_secret')throw new Error('SECRET_NOT_REQUESTED');
 const requested=validateCall(call.name,call.input).secrets.map(x=>x.key);
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!requested.includes(k)))throw new Error('SECRET_NOT_REQUESTED');
 const statuses=[];for(const name of requested){const value=values[name];if(value!==undefined&&typeof value!=='string')throw new Error('Invalid secret.');
 if(typeof value==='string'&&value.length>16000)throw new Error('Secret too long.');
 if(value?.trim())await vault.set(name,value);statuses.push({key:name,status:value?.trim()?'provided':'skipped'});}
 messages.push(answerMessage(messages,id,{secrets:statuses,message:'Use the named secret placeholders; values are stored privately.'}));return {secrets:statuses};
}
export function askingNote(capabilities={}){
 const names=Object.keys(HITL_CANCELLED).filter(n=>capabilities[n]!==false);
 return 'Human interaction tools available: '+names.join(', ')+'. Deliver at most one card per turn, batch related questions, use short option labels, write your explanation before delivering the card. Never emit card markup as text. A valid card ends your turn. Honor standing approvals and declined requests: do not re-ask or work around a denial. Secrets must be requested with request_secret and referenced only as named placeholders. Never ask for subscription OAuth tokens. notify is non-blocking. Scheduled runs pause on cards and resume only after an answer.';
}
