import type {Creation} from "./types";
export type DeliveryStage="generating"|"analyzing"|"ready"|"image-ready"|"review-pending"|"failed";
export type DeliveryState={id:number;stage:DeliveryStage;reviewed:number;total:number;message:string};
export type ReviewStatus="scored"|"pending"|"failed"|"skipped";
export const reviewConcurrency=2;
const workspaceChanged="Your workspace changed. Check the original project for its saved result.";
export async function deliverImages<T extends {creations:Creation[];partial:boolean}>(options:{
 generate:()=>Promise<T>;review?:(item:Creation)=>Promise<unknown>;current:()=>boolean;
 onImages:(result:T)=>void|Promise<void>;onStage:(stage:DeliveryStage,reviewed:number,total:number)=>void;
 onReview?:(id:string,status:ReviewStatus)=>void;holdMs?:number;
}){
 const live=()=>options.current();
 const stage=(value:DeliveryStage,reviewed:number,total:number)=>{if(live())options.onStage(value,reviewed,total);};
 const report=(id:string,status:ReviewStatus)=>{if(live())options.onReview?.(id,status);};
 stage("generating",0,0);
 let result:T;
 try{result=await options.generate();}catch(error){stage("failed",0,0);throw error;}
 if(!live())throw new Error(workspaceChanged);
 const items=result.creations,total=items.length;
 if(!options.review){
  for(const creation of items)report(creation.id,"skipped");
  await options.onImages(result);
  if(!live())throw new Error(workspaceChanged);
  stage("image-ready",0,total);
  return result;
 }
 const review=options.review;
 let reviewed=0,failed=0;
 const startReviews=()=>{
  let cursor=0;
  return Promise.all(Array.from({length:Math.min(reviewConcurrency,total)},async()=>{
   for(;;){
    if(!live())return;
    const index=cursor++;
    if(index>=total)return;
    const creation=items[index];
    stage("analyzing",reviewed,total);
    try{
     await review(creation);
     if(!live())return;
     report(creation.id,"scored");
    }catch{
     if(!live())return;
     failed++;
     report(creation.id,"failed");
    }
    reviewed++;
   }
  }));
 };
 if(options.onReview){
  for(const creation of items)report(creation.id,"pending");
  const work=startReviews();
  let holdTimer:ReturnType<typeof setTimeout>|undefined;
  const hold=new Promise<void>((resolve)=>{holdTimer=setTimeout(resolve,options.holdMs??45_000);});
  await Promise.race([work,hold]);
  if(holdTimer)clearTimeout(holdTimer);
  if(!live())throw new Error(workspaceChanged);
  // If onImages throws here, background reviews keep calling review() and onReview; OP-7 must handle that.
  await options.onImages(result);
  if(!live())throw new Error(workspaceChanged);
  if(reviewed<total)stage("review-pending",reviewed,total);
  await work;
  if(!live())throw new Error(workspaceChanged);
  stage(failed?"review-pending":"ready",reviewed,total);
  return result;
 }
 await options.onImages(result);
 if(!live())throw new Error(workspaceChanged);
 await startReviews();
 if(!live())throw new Error(workspaceChanged);
 stage(failed?"review-pending":"ready",reviewed,total);
 return result;
}
