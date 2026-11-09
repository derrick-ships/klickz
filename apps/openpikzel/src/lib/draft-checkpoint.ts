import {z} from "zod";
import {settingsSchema} from "./validation";
import type {WorkspaceDraft} from "./workspaces";
const schema=z.object({
 savedAt:z.number(),chatId:z.string().nullable(),
 draft:z.object({
  prompt:z.string().max(2400).optional(),title:z.string().max(100).optional(),
  tool:z.enum(["generate","recreate","analyze","edit","title"]).optional(),
  settings:settingsSchema.optional(),refs:z.array(z.string().max(400)).max(6).optional(),
  personaId:z.string().optional(),styleId:z.string().optional(),preset:z.string().max(120).optional(),
  videoBrief:z.string().max(2400).optional(),selection:z.string().nullable().optional(),
  parentId:z.string().nullable().optional(),titleAction:z.enum(["image","ideas"]).optional(),
  textProvider:z.enum(["openai","google"]).optional(),includeVision:z.boolean().optional(),videoUrl:z.string().max(500).optional(),autoReview:z.boolean().optional(),draftSavedAt:z.number().optional(),manualTitle:z.boolean().optional(),
  creativeDraft:z.object({includeReferences:z.boolean().optional(),provider:z.enum(["openai","google"]).optional(),modelChoice:z.enum(["economy","standard"]).optional(),draft:z.string().max(2400).optional(),messages:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(4000)})).max(12).optional()}).optional(),
 }),
});
type Store=Pick<Storage,"getItem"|"setItem">;
export function readDraftCheckpoint(storage:Store,owner:string):{savedAt:number;chatId:string|null;draft:WorkspaceDraft}|null{
 try {const raw=storage.getItem("openpikzels.draftCheckpoint."+owner);if(!raw)return null;const parsed=schema.safeParse(JSON.parse(raw));return parsed.success?parsed.data:null;}catch{return null;}
}
export function writeDraftCheckpoint(storage:Store,owner:string,value:{chatId:string|null;draft:WorkspaceDraft}){
 try{storage.setItem("openpikzels.draftCheckpoint."+owner,JSON.stringify(schema.parse({...value,savedAt:Date.now()})));return true;}catch{return false;}
}
