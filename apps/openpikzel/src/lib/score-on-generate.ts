import {providerOfChoice} from "./model-choice";
import {pickVisionProvider,type VisionProvider} from "./vision-provider";
import type {DeliveryState} from "./generation-delivery";
import type {Evaluation} from "./types";
import {canScore} from "./scorers";

export type ScorePlan={review:boolean;includeVision:boolean;critiqueProvider:VisionProvider|null};

export function scorePlan(keys:{jev?:boolean;anthropic?:boolean;openai?:boolean;google?:boolean;models?:{reviewer?:string;scorer?:string}}|null|undefined):ScorePlan{
 const preferred=providerOfChoice(keys?.models?.reviewer||"auto");
 const critiqueProvider=keys?pickVisionProvider(keys,preferred):null;
 // Any connected scorer key gives the numbers: Jev, OpenAI (Decisions), Claude or Google.
 if(!canScore(keys))return {review:false,includeVision:false,critiqueProvider:null};
 return {review:true,includeVision:!!critiqueProvider,critiqueProvider};
}

export function reviewerName(provider:VisionProvider|null|undefined){
 return provider==="anthropic"?"Claude":provider==="openai"?"OpenAI":provider==="google"?"Google":null;
}

export function missingVisionKeyMessage(provider?:VisionProvider|null){
 const name=reviewerName(provider);
 return name?"Connect your selected "+name+" API key for the extra image review.":"Connect a Claude, OpenAI, or Google API key for the extra image review.";
}

export type ScoreView=
 | {kind:"no-jev"}
 | {kind:"pending"}
 | {kind:"failed"}
 | {kind:"idle"}
 | {kind:"scored";reviewer:"Claude"|"OpenAI"|"Google"|null;visionFailed?:boolean;fallback?:string};


export function critiqueProviderFromScore(score?:Pick<Evaluation,"contributors">|null):VisionProvider|undefined{
 const provider=score?.contributors?.find(item=>item.role==="image-review")?.provider;
 return provider==="Anthropic API"?"anthropic":provider==="OpenAI API"?"openai":provider==="Google API"?"google":undefined;
}

/** "Scored by Claude · Jev didn't answer" when a fallback gave the numbers; null when the first choice did. */
export function fallbackNote(score:Pick<Evaluation,"scoring">|null|undefined){
 const route=score?.scoring?.route;if(!route?.length)return null;
 const failed=route.filter(r=>r.outcome==="failed"),used=route.find(r=>r.outcome==="scored");
 if(!failed.length||!used)return null;
 const name=(s:string)=>s==="jev"?"Jev":s==="anthropic"?"Claude":s==="openai"?"OpenAI":"Google";
 return "Scored by "+name(used.scorer)+" · "+name(failed[0].scorer)+" didn’t answer";
}
export function scoreStatusFromEvaluation(score:Pick<Evaluation,"vision"|"warnings"|"contributors"|"scoring">):ScoreView{
 const fallback=fallbackNote(score)||undefined;
 if(score.warnings?.includes("Image review did not finish"))return {kind:"scored",reviewer:null,visionFailed:true,fallback};
 if(!score.vision)return {kind:"scored",reviewer:null,fallback};
 const provider=score.contributors?.find(item=>item.role==="image-review")?.provider;
 const reviewer=provider==="Anthropic API"?"Claude":provider==="OpenAI API"?"OpenAI":provider==="Google API"?"Google":null;
 return {kind:"scored",reviewer,fallback};
}

export function scoreStatusCopy(status:ScoreView):{title:string;action?:"connect"|"retry"|"analyze"}{
 if(status.kind==="no-jev")return {title:"Connect scoring to see this image’s score",action:"connect"};
 if(status.kind==="pending")return {title:"Score on the way"};
 if(status.kind==="failed")return {title:"Score did not finish",action:"retry"};
 if(status.kind==="idle")return {title:"Review thumbnail and title",action:"analyze"};
 if(status.visionFailed)return {title:"Image review did not finish"};
 if(!status.reviewer)return {title:"Score without image review"};
 return {title:"Reviewed by "+status.reviewer};
}

export function deliveryCopy(state:Pick<DeliveryState,"stage"|"reviewed"|"total">,elapsed=0){
 const label=state.stage==="generating"?(elapsed>60000?"Still working: writing the prompt with your thumbnail rules, then drawing it…":"Writing the prompt with your thumbnail rules…"):state.stage==="analyzing"?"Image ready. Analyzing…":state.stage==="ready"?"Image and analysis ready":state.stage==="image-ready"?"Image ready":state.stage==="review-pending"?(state.reviewed<state.total?"Score on the way":"Score did not finish"):"Generation did not finish.";
 const detail=state.stage==="analyzing"?"Reviewing "+(state.reviewed+1)+" of "+state.total+". You can inspect your saved image while the score and comments arrive.":state.stage==="review-pending"?(state.reviewed<state.total?"The score will appear when it lands. You can inspect your saved image in the meantime.":"Your image is safe. Retry score to reuse the same request, or check API activity; generating the image again is unnecessary."):state.stage==="ready"?"Scores and comments are saved. One-Click Fix is available when the assessment supports a concrete edit.":state.stage==="image-ready"?"Connect scoring to see this image’s score":state.stage==="failed"?"Check API activity and saved creations before starting another paid request.":"The studio stays available while your provider works.";
 return {label,detail};
}

/** The fix is blocked only because the image itself was never reviewed: complete score, title present, no vision. */
export function needsImageReview(score:{fixBlocked?:boolean;vision?:boolean;partial?:boolean;context?:{title?:string}|null}|null|undefined){
 return !!score&&!!score.fixBlocked&&!score.vision&&!score.partial&&!!score.context?.title;
}
