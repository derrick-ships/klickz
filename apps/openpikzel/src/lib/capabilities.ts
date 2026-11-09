import {imageModels} from "./image-models";
import {defaultPromptModel,instructionVersion} from "./instructions";
import type {Config} from "./types";
type Available=Pick<Config,"ai"|"openai"|"google"|"jev"|"youtube"|"textModels"|"promptModel"|"scoreModel">;
export function providerCapabilities(config:Available){
 const text=[{provider:"openai"as const,connectionSaved:!!config.openai,model:config.textModels?.openai||"gpt-5.5"},{provider:"google"as const,connectionSaved:!!config.google,model:config.textModels?.google||"gemini-3.5-flash-lite"}];
 return {instructionVersion,workspaceAIEnabled:config.ai,modelAccessVerified:false,fallbackAllowed:false,
 images:imageModels.map(model=>({id:model.id,name:model.name,provider:model.provider,apiModel:model.apiModel,connectionSaved:!!config[model.provider],operations:["generate","edit"],formatsOffered:["16:9","9:16"],maxReferenceImages:model.maxReferences,nativeOutputPreserved:true})),
 textRoles:{conversation:text,enhancement:text.map(provider=>({...provider,model:provider.provider==="openai"?config.promptModel||defaultPromptModel:provider.model})),titles:text,imageReview:text,profilePreparation:text},
 scoring:{provider:"jev",model:config.scoreModel||"jev-latest",connectionSaved:config.jev,pillars:["virality","clarity","idea","curiosity","emotion"]},
 video:{youtubeMetadataConnectionSaved:!!config.youtube,fullVideoAnalysis:false},subscriptionChat:false,higgsfieldImageExecution:false,
 automaticReview:{requiresOptIn:true,runsInBrowser:true},jobs:{savedOutcomes:true,statusRecovery:true,automaticPaidRetry:false,detachedWorker:false},analysisHistory:{readOnly:true,signedScoreVerification:true,currentImageDigestComparison:true},notice:"A saved key is not verified model entitlement or available credit. The selected provider is checked when the user requests an action."};
}
