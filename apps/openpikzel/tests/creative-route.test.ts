import {it,expect,vi,beforeEach} from "vitest";
import {AppError} from "../src/lib/validation";
const state=vi.hoisted(()=>({owned:true,dispatches:0,projectTitle:"Project",sourceTitle:"Original title",sourceScore:null as any,lastPayload:null as any,jobs:new Map<string,any>()}));
vi.mock("../src/lib/server",()=>({
 authenticated:async()=>({user:{id:"owner"},db:{from:(table:string)=>{let id="",operation="read",value:any;const chain:any={
  select:()=>chain,eq:(key:string,v:string)=>{if(key==="id")id=v;return chain;},
  maybeSingle:async()=>({data:table==="studio_jobs"?state.jobs.get(id)||null:!state.owned?null:table==="studio_conversations"?{id,title:state.projectTitle}:table==="studio_personas"?{id,name:"Selected persona",notes:"n".repeat(2000),identity_brief:"b".repeat(4000),refs:["owner/profile.png"]}:{id,title:state.sourceTitle,prompt:"Original thumbnail brief",score:state.sourceScore,image_path:null},error:null}),
  insert:(v:any)=>{operation="insert";value=v;return chain;},update:(v:any)=>{operation="update";value=v;return chain;},
  then:(resolve:any)=>{if(operation==="insert"){if(state.jobs.has(value.id))return Promise.resolve({error:{code:"23505"}}).then(resolve);state.jobs.set(value.id,value);}if(operation==="update")state.jobs.set(id,{...state.jobs.get(id),...value});return Promise.resolve({error:null}).then(resolve);}
 };return chain;}}}),
 requireAI:()=>{},withUserProviders:async(_r:Request,run:()=>Promise<Response>)=>run(),failure:(e:any)=>Response.json({error:e.message},{status:e instanceof AppError?e.status:400})
}));
// The real reserveJob/updateJob code exercises durable payload comparison; only provider inference is mocked.
vi.mock("../src/lib/creative-text",()=>({enhancePrompt:async()=>{state.dispatches++;return{value:{prompt:"A clear revised prompt",changes:[]},model:"fixture",provider:"OpenAI API",instructionVersion:"fixture"};},structuredCreativeText:async(_provider:any,_instructions:any,payload:any)=>{state.lastPayload=payload;state.dispatches++;return{value:{reply:"Context-aware fixture",proposal:null},provider:"OpenAI API",model:"fixture",instructionVersion:"fixture"};},conversationInstructions:"fixture",chatReplySchema:{parse:(x:any)=>x}}));
import {POST} from "../src/app/api/creative/route";
const request=(extra={})=>new Request("https://openpikzels.com/api/creative",{method:"POST",body:JSON.stringify({task:"enhance",provider:"openai",prompt:"Original thumbnail brief",requestId:"11111111-1111-4111-8111-111111111111",conversationId:"22222222-2222-4222-8222-222222222222",...extra})});
beforeEach(()=>{state.owned=true;state.dispatches=0;state.projectTitle="Project";state.sourceTitle="Original title";state.sourceScore=null;state.lastPayload=null;state.jobs.clear();});
it("rejects an unavailable project before reservation or provider dispatch",async()=>{state.owned=false;const r=await POST(request());expect(r.status).toBe(404);expect(state.jobs.size).toBe(0);expect(state.dispatches).toBe(0);});
it("replays a saved creative result without a second model call",async()=>{expect((await POST(request())).status).toBe(200);const r=await POST(request());expect(r.status).toBe(200);expect((await r.json()).kind).toBe("prompt-enhancement");expect(state.dispatches).toBe(1);});
it("replays the original result after the project title and source assessment change",async()=>{const input={creationId:"33333333-3333-4333-8333-333333333333"};const first=await POST(request(input));expect(first.status).toBe(200);const saved=await first.json();state.projectTitle="Renamed project";state.sourceTitle="New source title";state.sourceScore={overall:72,dimensions:{clarity:{score:80,observation:"A new assessment"}}};const retry=await POST(request(input));expect(retry.status).toBe(200);expect(await retry.json()).toEqual(saved);expect(state.dispatches).toBe(1);});
it("rejects a changed submitted prompt under the same request ID",async()=>{expect((await POST(request())).status).toBe(200);const retry=await POST(request({prompt:"A different requested thumbnail"}));expect(retry.status).toBe(409);expect(state.dispatches).toBe(1);});
it("retains ownership checks before replaying a saved result",async()=>{expect((await POST(request())).status).toBe(200);state.owned=false;expect((await POST(request())).status).toBe(404);expect(state.dispatches).toBe(1);});
it("never redispatches an unresolved creative request",async()=>{expect((await POST(request())).status).toBe(200);const row=[...state.jobs.values()][0];state.jobs.set(row.id,{...row,state:"reconciling"});expect((await POST(request())).status).toBe(409);expect(state.dispatches).toBe(1);});
it("rejects arbitrary model/provider names before dispatch",async()=>{const r=await POST(request({provider:"https://external.invalid"}));expect(r.status).toBe(400);expect(state.dispatches).toBe(0);});

it("no longer accepts the retired creative chat task",async()=>{const r=await POST(request({task:"chat",personaId:"44444444-4444-4444-8444-444444444444"}));expect(r.status).toBe(400);expect(state.dispatches).toBe(0);expect(state.jobs.size).toBe(0);});
it("rejects a foreign reference before reserving or calling a text model",async()=>{const r=await POST(request({task:"enhance",prompt:"A specific thumbnail prompt",referencePaths:["other-user/private.png"]}));expect(r.status).toBe(403);expect(state.dispatches).toBe(0);expect(state.jobs.size).toBe(0);});
