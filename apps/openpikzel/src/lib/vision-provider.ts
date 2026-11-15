import type {ProviderKeys} from "./provider-context";
export type VisionProvider="anthropic"|"openai"|"google";
export const ANTHROPIC_VISION_MODEL="claude-opus-5-5";
export function anthropicVisionModel(){
 return process.env.ANTHROPIC_VISION_MODEL||ANTHROPIC_VISION_MODEL;
}
/** The reviewer the user chose in Settings → Models if its key is connected; else Claude, OpenAI, Google in that order. */
export function pickVisionProvider(keys:Pick<ProviderKeys,"anthropic"|"openai"|"google">|Record<string,unknown>,preferred?:VisionProvider|null):VisionProvider|null{
 if(preferred&&keys[preferred])return preferred;
 if(keys.anthropic)return "anthropic";
 if(keys.openai)return "openai";
 if(keys.google)return "google";
 return null;
}
