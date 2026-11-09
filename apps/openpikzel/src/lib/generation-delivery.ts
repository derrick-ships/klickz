import type {Creation} from "./types";
export type DeliveryStage="generating"|"analyzing"|"ready"|"image-ready"|"review-pending"|"failed";
export type DeliveryState={id:number;stage:DeliveryStage;reviewed:number;total:number;message:string};
export async function deliverImages<T extends {creations:Creation[];partial:boolean}>(options:{
 generate:()=>Promise<T>;review?:(item:Creation)=>Promise<unknown>;current:()=>boolean;
 onImages:(result:T)=>void|Promise<void>;onStage:(stage:DeliveryStage,reviewed:number,total:number)=>void;
}){
 options.onStage("generating",0,0);
 let result:T;
 try{result=await options.generate();}catch(error){if(options.current())options.onStage("failed",0,0);throw error;}
 if(!options.current())throw new Error("Your workspace changed. Check the original project for its saved result.");
 await options.onImages(result);
 if(!options.current())throw new Error("Your workspace changed. Check the original project for its saved result.");
 if(!options.review){options.onStage("image-ready",0,result.creations.length);return result;}
 let reviewed=0;
 for(const item of result.creations){
  if(!options.current())throw new Error("Your workspace changed. Check the original project for its saved result.");
  options.onStage("analyzing",reviewed,result.creations.length);
  try{await options.review(item);}catch(error){
   if(!options.current())throw error;
   options.onStage("review-pending",reviewed,result.creations.length);return result;
  }
  reviewed++;
 }
 if(options.current())options.onStage("ready",reviewed,result.creations.length);
 return result;
}
