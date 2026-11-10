import type {ProviderKeys} from "./provider-context";
export type VisionProvider="anthropic"|"openai"|"google";
export const ANTHROPIC_VISION_MODEL="claude-opus-5-5";
export function anthropicVisionModel(){
 return process.env.ANTHROPIC_VISION_MODEL||ANTHROPIC_VISION_MODEL;
}
export function pickVisionProvider(keys:Pick<ProviderKeys,"anthropic"|"openai"|"google">|Record<string,unknown>):VisionProvider|null{
 if(keys.anthropic)return "anthropic";
 if(keys.openai)return "openai";
 if(keys.google)return "google";
 return null;
}
