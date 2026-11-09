import type {ImageModel} from "./types";
export const imageModels: {id:ImageModel;name:string;provider:"openai"|"google";providerName:string;apiModel:string;maxReferences:number}[] = [
 {id:"flare",name:"Flare 2.6",provider:"openai",providerName:"OpenAI",maxReferences:16,apiModel:"gpt-image-2.6-flare"},
 {id:"sunburst",name:"Sunburst 2.6",provider:"openai",providerName:"OpenAI",maxReferences:16,apiModel:"gpt-image-2.6-sunburst"},
 {id:"gemini-flash",name:"Gemini Flash",provider:"google",providerName:"Google",maxReferences:14,apiModel:"gemini-3.1-flash-image"},
 {id:"gemini-pro",name:"Gemini Pro",provider:"google",providerName:"Google",maxReferences:14,apiModel:"gemini-3-pro-image"},
];
export function imageModel(id:ImageModel){const model=imageModels.find(m=>m.id===id);if(!model)throw new Error("Unknown image model");return model;}
