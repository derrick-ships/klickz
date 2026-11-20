import type {CreativeDraft} from "../components/creative/creative-partner";
import type {Creation,Settings} from './types';
export type WorkspaceDraft={textProvider?:"openai"|"google";autoReview?:boolean;creativeDraft?:CreativeDraft;manualTitle?:boolean;draftSavedAt?:number;prompt?:string;title?:string;tool?:string;settings?:Settings;refs?:string[];personaId?:string;personaIds?:string[];elementIds?:string[];styleId?:string;preset?:string;videoBrief?:string;videoUrl?:string;selection?:string|null;parentId?:string|null;titleAction?:"image"|"ideas";includeVision?:boolean};
export type Conversation={id:string;title:string;draft:WorkspaceDraft;created_at:string;updated_at:string};
export function automaticChatTitle(videoTitle?:string, creationTitle?:string):string {
 for(const candidate of [videoTitle,creationTitle]){const name=candidate?.trim().replace(/\s+/g,' ')||'';if(name.replace(/[^\p{L}\p{N}]/gu,'').length>=3&&!/^@\s*$/.test(name))return name.slice(0,80);}
 return 'New chat';
}
export function groupChats(chats:Conversation[],now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),day=86400000,groups=new Map<string,Conversation[]>();
 for(const c of [...chats].sort((a,b)=>b.updated_at.localeCompare(a.updated_at))){const stamp=new Date(c.updated_at),date=new Date(stamp.getFullYear(),stamp.getMonth(),stamp.getDate()).getTime(),label=date>=today?'Today':date>=today-day?'Yesterday':'Earlier';groups.set(label,[...(groups.get(label)||[]),c]);}
 return [...groups].map(([label,items])=>({label,items}));
}
export function searchChats(chats:Conversation[],creations:Pick<Creation,'prompt'|'conversation_id'>[],query:string){const q=query.trim().toLocaleLowerCase();return !q?chats:chats.filter(c=>[c.title,c.draft.prompt,c.draft.title,c.draft.videoBrief].some(text=>text?.toLocaleLowerCase().includes(q))||creations.some(x=>x.conversation_id===c.id&&x.prompt.toLocaleLowerCase().includes(q)));}
