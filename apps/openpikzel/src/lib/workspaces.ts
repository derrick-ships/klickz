import type {Creation,Settings} from './types';
export type WorkspaceDraft={manualTitle?:boolean;draftSavedAt?:number;prompt?:string;title?:string;tool?:string;settings?:Settings;refs?:string[];personaId?:string;styleId?:string;preset?:string;videoBrief?:string;selection?:string|null;parentId?:string|null;titleAction?:"image"|"ideas";includeVision?:boolean};
export type Conversation={id:string;title:string;draft:WorkspaceDraft;created_at:string;updated_at:string};
export function groupChats(chats:Conversation[],now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),day=86400000,groups=new Map<string,Conversation[]>();
 for(const c of [...chats].sort((a,b)=>b.updated_at.localeCompare(a.updated_at))){const stamp=new Date(c.updated_at),date=new Date(stamp.getFullYear(),stamp.getMonth(),stamp.getDate()).getTime(),label=date>=today?'Today':date>=today-day?'Yesterday':'Earlier';groups.set(label,[...(groups.get(label)||[]),c]);}
 return [...groups].map(([label,items])=>({label,items}));
}
export function searchChats(chats:Conversation[],creations:Pick<Creation,'prompt'|'conversation_id'>[],query:string){const q=query.trim().toLocaleLowerCase();return !q?chats:chats.filter(c=>[c.title,c.draft.prompt,c.draft.title,c.draft.videoBrief].some(text=>text?.toLocaleLowerCase().includes(q))||creations.some(x=>x.conversation_id===c.id&&x.prompt.toLocaleLowerCase().includes(q)));}
export const publicStyles=[
 {name:'Bold & bright',description:'One unmistakable subject, saturated contrast and a short headline.',colors:['#ff3046','#ffe563','#111111']},
 {name:'Documentary',description:'Natural portrait, a restrained palette and editorial framing.',colors:['#d6cdbd','#35463f','#141817']},
 {name:'Cinematic',description:'Directional lighting, deep shadows and deliberate separation.',colors:['#f9a44a','#2b737b','#13171b']},
 {name:'Clean editorial',description:'Generous negative space, precise typography and a clear promise.',colors:['#ece9e1','#d52840','#202020']},
 {name:'Minimal',description:'A single visual idea with fewer competing elements.',colors:['#efefef','#8c8c8c','#202020']},
];
