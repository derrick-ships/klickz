import OpenAI from "openai";
import {z} from "zod";
import {providerKey,hasProvider} from "./provider-context";
import {googleText} from "./google";
import {AppError} from "./validation";
import {defaultPromptModel,instructionVersion,promptEnhancementInstructions} from "./instructions";
export const enhancementSchema=z.object({prompt:z.string().min(8).max(2400),changes:z.array(z.string().max(240)).max(5)});
export async function structuredCreativeText(provider:"openai"|"google",instructions:string,context:unknown,modelChoice:"economy"|"standard"="economy",images:Buffer[]=[]){
 if(!hasProvider(provider))throw new AppError(403,"Connect your own "+(provider==="openai"?"OpenAI":"Google")+" API key in Connections.");
 const model=provider==="google"?process.env.GOOGLE_TEXT_MODEL||"gemini-3.5-flash-lite":modelChoice==="standard"?process.env.OPENAI_TEXT_MODEL||"gpt-5.5":process.env.OPENAI_PROMPT_MODEL||defaultPromptModel;
 try{
  if(provider==="google")return {value:JSON.parse(await googleText(instructions,JSON.stringify(context),images,true)),provider:"Google API",model,instructionVersion};
  const api=new OpenAI({apiKey:providerKey("openai"),maxRetries:0,timeout:45000});
  const response=await api.responses.create({model,store:false,instructions,input:[{role:"user",content:[{type:"input_text",text:JSON.stringify(context)},...images.map(image=>({type:"input_image" as const,image_url:"data:image/jpeg;base64,"+image.toString("base64"),detail:"low" as const}))]}],text:{format:{type:"json_object"}},max_output_tokens:1600},{maxRetries:0,timeout:45000});
  return {value:JSON.parse(response.output_text),provider:"OpenAI API",model,instructionVersion};
 }catch(error){
  if(error instanceof AppError)throw error;
  const status=error&&typeof error==="object"&&"status" in error?Number(error.status):0;
  if(status===401||status===403||status===404)throw new AppError(status,"This provider key cannot access the selected conversation model. Check Connections. No fallback model was used.");
  throw new AppError(502,"The text request could not finish. Your draft is unchanged. Check API activity before trying again.");
 }
}
export async function enhancePrompt(input:{prompt:string;title:string;mode:string;format:string;provider:"openai"|"google"},selectedContext?:unknown){
 const result=await structuredCreativeText(input.provider,promptEnhancementInstructions,selectedContext?{draft:input,selectedContext}:input);
 return {...result,value:enhancementSchema.parse(result.value)};
}
