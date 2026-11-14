import {describe,it,expect,vi,beforeEach,beforeAll} from 'vitest';
import sharp from 'sharp';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const owner='11111111-1111-4111-8111-111111111111';
const state=vi.hoisted(()=>({images:new Map<string,Buffer>(),inserted:[] as any[],personas:[] as any[],styles:[] as any[],oauth:undefined as any, local:undefined as any}));
vi.mock('../src/lib/server',async()=>{
 const actual=await vi.importActual<typeof import('../src/lib/server')>('../src/lib/server');
 const owner='11111111-1111-4111-8111-111111111111';
 return {...actual,authenticated:async()=>({user:{id:owner},oauth:state.oauth,db:{storage:{from:()=>({download:async(path:string)=>({data:state.images.has(path)?new Blob([new Uint8Array(state.images.get(path)!)]):null,error:null}),createSignedUrl:async(path:string,ttl:number)=>({data:{signedUrl:`https://example.test/${ttl}/${path}`},error:null})})},from:(table:string)=>{
  if(state.local){
   let row:Record<string,unknown>|undefined;const filters:Record<string,unknown>={};
   const query=async()=>{
    try{
     if(row){const keys=Object.keys(row);const result=await state.local.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) returning *`,Object.values(row));return {data:result.rows[0],error:null};}
     const keys=Object.keys(filters);const result=await state.local.query(`select * from ${table}`+(keys.length?' where '+keys.map((k,i)=>`${k}=$${i+1}`).join(' and '):''),Object.values(filters));return {data:result.rows,error:null};
    }catch(error){return {data:null,error};}
   };
   const chain:any={insert:(value:Record<string,unknown>)=>{row=value;return chain;},select:()=>chain,eq:(key:string,value:unknown)=>{filters[key]=value;return chain;},single:query,then:(resolve:any,reject:any)=>query().then(resolve,reject)};
   return chain;
  }
  const list=table==='studio_personas'?state.personas:table==='studio_styles'?state.styles:null;
  let row:any;let patch:any;const filters:Record<string,unknown>={};
  const matches=()=>(list||[]).filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
  const chain:any={
   insert:(v:any)=>{row={id:'33333333-3333-4333-8333-333333333333',user_id:owner,...v};state.inserted.push(v);list?.push(row);return chain;},
   update:(v:any)=>{patch=v;return chain;},
   select:(..._cols:string[])=>chain,
   eq:(k:string,v:unknown)=>{filters[k]=v;return chain;},
   single:async()=>{
    if(row)return{data:row,error:null};
    const found=matches()[0];
    if(!found)return{data:null,error:{message:'not found'}};
    if(patch)Object.assign(found,patch);
    return{data:found,error:null};
   },
   then:(resolve:any,reject:any)=>Promise.resolve({data:matches(),error:null}).then(resolve,reject),
  };
  return chain;
 }}})};
});
vi.mock('../src/lib/oauth/core', async () => {
 const actual = await vi.importActual<typeof import('../src/lib/oauth/core')>('../src/lib/oauth/core');
 return {...actual, resolveAccess: async () => {
  const {authenticated} = await import('../src/lib/server');
  const context = await authenticated(new Request('https://studio.example'));
  return {...context, oauth:{scope:['studio:read','studio:write']}};
 }};
});
const request=(body:unknown,origin='https://studio.example',method:'POST'|'PATCH'='POST')=>new Request('https://studio.example/api/profiles',{method,headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
beforeAll(async()=>{for(const [i,color]of ['#ca3451','#385d8a','#6aa77c'].entries())state.images.set(owner+'/ref'+i+'.png',await sharp({create:{width:20,height:20,channels:3,background:color}}).png().toBuffer());});
beforeEach(()=>{state.inserted=[];state.personas=[];state.styles=[];state.oauth=undefined;state.local=undefined;process.env.APP_ORIGIN='https://studio.example';});
describe('profile API and official YouTube adapter',()=>{
 it('saves a distinct, owned, consented persona without model inference',async()=>{const {POST}=await import('../src/app/api/profiles/route');const r=await POST(request({kind:'persona',name:'Alice',notes:'Preserve identity',permission:true,refs:[0,1,2].map(i=>owner+'/ref'+i+'.png')}));expect(r.status).toBe(200);expect(state.inserted[0].consent_at).toBeTruthy();expect(JSON.stringify(await r.json())).not.toContain('API_KEY');});
 it('rejects cross-owner reference paths before a profile is written',async()=>{const {POST}=await import('../src/app/api/profiles/route');const r=await POST(request({kind:'persona',name:'Alice',permission:true,refs:[owner+'/ref0.png',owner+'/ref1.png','22222222-2222-4222-8222-222222222222/private.png']}));expect(r.status).toBe(403);expect(state.inserted).toHaveLength(0);});
 it('rejects duplicate decoded pictures even when storage paths differ',async()=>{state.images.set(owner+'/duplicate.png',state.images.get(owner+'/ref0.png')!);const {POST}=await import('../src/app/api/profiles/route');const r=await POST(request({kind:'style',name:'Documentary',refs:[owner+'/ref0.png',owner+'/duplicate.png',owner+'/ref2.png']}));expect(r.status).toBe(400);expect(state.inserted).toHaveLength(0);});
 it('enforces same origin for web writes and write scope for agents',async()=>{const {POST}=await import('../src/app/api/profiles/route');expect((await POST(request({},'https://evil.example'))).status).toBe(403);state.oauth={scope:['studio:read']};expect((await POST(request({}))).status).toBe(403);});
 it('uses the official API host with a private header and preserves video ordering',async()=>{const {channelVideos}=await import('../src/lib/youtube'),calls:any[]=[];const fetcher=async(url:any,init:any)=>{calls.push({url:String(url),init});if(String(url).includes('/channels?'))return Response.json({items:[{id:'UCabcdefghijklmnopqrstuv',snippet:{title:'Channel'},statistics:{subscriberCount:'123'}}]});if(String(url).includes('/search?'))return Response.json({items:[{id:{videoId:'00000000002'}},{id:{videoId:'00000000001'}}]});return Response.json({items:[1,2].map(i=>({id:String(i).padStart(11,'0'),snippet:{title:'Video'+i},statistics:{viewCount:'100'},contentDetails:{duration:'PT1M'}}))});};const result=await channelVideos('fixture-private-key','@channel','popular','',fetcher as any);expect(result.videos.map(v=>v?.id)).toEqual(['00000000002','00000000001']);expect(calls.every(c=>new URL(c.url).hostname==='www.googleapis.com'&&!c.url.includes('fixture-private-key')&&c.init.headers['X-Goog-Api-Key']==='fixture-private-key')).toBe(true);});
 it('does not disclose API error bodies or keys on quota failures',async()=>{const {channelVideos}=await import('../src/lib/youtube');await expect(channelVideos('fixture-private-key','@channel','recent','',async()=>Response.json({error:{message:'Secret fixture-private-key'}},{status:403}) as any)).rejects.toThrow('Enable YouTube Data API v3');});
});

const refs=[0,1,2].map(i=>owner+'/ref'+i+'.png');
const personaBody=(name:string,extra:Record<string,unknown>={})=>({kind:'persona',name,notes:'Preserve identity',permission:true,refs,...extra});
const styleBody=(name:string)=>({kind:'style',name,notes:'Palette',refs});
async function jsonOf(res:Response){try{return await res.json();}catch{return {};}}

describe('unique profile names on the profiles API',()=>{
 it('stores a trimmed name and lets a persona and a style share one',async()=>{
  const {POST}=await import('../src/app/api/profiles/route');
  const persona=await POST(request(personaBody('  Alice  ')));
  expect(persona.status).toBe(200);
  expect(state.inserted[0].name).toBe('Alice');
  const style=await POST(request(styleBody('Alice')));
  expect(style.status).toBe(200);
  expect(state.inserted[1].name).toBe('Alice');
  expect(state.personas).toHaveLength(1);
  expect(state.styles).toHaveLength(1);
 });
 it('rejects a case or whitespace clash on create and writes nothing',async()=>{
  const {POST}=await import('../src/app/api/profiles/route');
  expect((await POST(request(personaBody('Alice')))).status).toBe(200);
  const before=state.personas.length;
  const clash=await POST(request(personaBody('  ALICE  ')));
  expect(clash.status).toBe(409);
  expect((await jsonOf(clash)).error).toBe('A persona named ALICE already exists.');
  expect(state.personas).toHaveLength(before);
 });
 it('rejects a rename clash, writes nothing, and still fails short names after trim',async()=>{
  const {POST,PATCH}=await import('../src/app/api/profiles/route');
  expect((await POST(request(personaBody('Alice')))).status).toBe(200);
  state.personas.push({id:'44444444-4444-4444-8444-444444444444',user_id:owner,name:'Beatrice',refs});
  const clash=await PATCH(request({kind:'persona',id:'44444444-4444-4444-8444-444444444444',name:'  alice '},undefined,'PATCH'));
  expect(clash.status).toBe(409);
  expect((await jsonOf(clash)).error).toBe('A persona named alice already exists.');
  expect(state.personas.find(p=>p.id==='44444444-4444-4444-8444-444444444444').name).toBe('Beatrice');
  const short=await PATCH(request({kind:'persona',id:'44444444-4444-4444-8444-444444444444',name:'  ab  '},undefined,'PATCH'));
  expect(short.status).toBe(400);
  expect(state.personas.find(p=>p.id==='44444444-4444-4444-8444-444444444444').name).toBe('Beatrice');
  const renamed=await PATCH(request({kind:'persona',id:'44444444-4444-4444-8444-444444444444',name:'  Alicia  '},undefined,'PATCH'));
  expect(renamed.status).toBe(200);
  expect((await jsonOf(renamed)).profile.name).toBe('Alicia');
 });
 it('resolves one name, 404 when none match, and 409 when several still match',async()=>{
  const {GET}=await import('../src/app/api/profiles/route');
  const {resolveProfileName}=await import('../src/lib/profile-name');
  state.personas.push({id:'33333333-3333-4333-8333-333333333333',user_id:owner,name:'Alice',refs});
  const found=await GET(new Request('https://studio.example/api/profiles?kind=persona&name=  alice ',{headers:{origin:'https://studio.example'}}));
  expect(found.status).toBe(200);
  expect((await jsonOf(found)).profile.id).toBe('33333333-3333-4333-8333-333333333333');
  const missing=await GET(new Request('https://studio.example/api/profiles?kind=style&name=Alice',{headers:{origin:'https://studio.example'}}));
  expect(missing.status).toBe(404);
  expect((await jsonOf(missing)).error).toBe('No style named Alice');
  const none=await GET(new Request('https://studio.example/api/profiles?kind=persona&name=Missing',{headers:{origin:'https://studio.example'}}));
  expect(none.status).toBe(404);
  expect((await jsonOf(none)).error).toBe('No persona named Missing');
  const a={id:'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',name:'Derrick'};
  const b={id:'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',name:'derrick'};
  const ambiguous=resolveProfileName([a,b],' Derrick ', 'persona');
  expect(ambiguous.status).toBe(409);
  if(ambiguous.status!==409)throw new Error('expected 409');
  expect(ambiguous.error).toBe('Several personas are named Derrick. Rename one in the studio. Candidates: Derrick (aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1), derrick (aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2).');
  expect(ambiguous).not.toHaveProperty('profile');
 });
 it('shares profile names between the real MCP transport and profiles API',async()=>{
  const {POST:api}=await import('../src/app/api/profiles/route');
  const {POST:mcp}=await import('../src/app/mcp/route');
  const invoke=async(name:string)=>{
   const response=await mcp(new Request('https://studio.example/mcp',{method:'POST',headers:{Authorization:'Bearer opz1.fixture',Accept:'application/json,text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_profile',arguments:{kind:'persona',name,notes:'',permission:true,references:refs}}})}));
   expect(response.status).toBe(200);
   return response.json();
  };
  expect((await api(request(personaBody('Alice')))).status).toBe(200);
  state.oauth={scope:['studio:read','studio:write']};
  const duplicate=await invoke(' alice ');
  expect(duplicate.result.isError).toBe(true);
  expect(duplicate.result.content[0].text).toContain('already exists');
  const created=await invoke('  Beatrice  ');
  expect(created.result.structuredContent.profile.name).toBe('Beatrice');
  expect((await api(request(personaBody('BEATRICE')))).status).toBe(409);
  expect(state.personas).toHaveLength(2);
 });
 it('shares real database writes across the MCP and API entry points',async()=>{
  const local=new PGlite();
  try{
   await local.exec(`create table studio_personas(id text primary key default gen_random_uuid()::text,user_id text,name text,notes text,refs text[],profile_status text,consent_at timestamptz,created_at timestamptz default now());create table studio_styles(id text primary key default gen_random_uuid()::text,user_id text,name text,notes text,refs text[],profile_status text,source jsonb,created_at timestamptz default now());`);
   await local.exec(readFileSync('supabase/migrations/20261110130000_profile_unique_names.sql','utf8'));
   state.local=local;
   const {POST:api}=await import('../src/app/api/profiles/route');
   const {POST:mcp}=await import('../src/app/mcp/route');
   expect((await api(request(personaBody('  İdea  ')))).status).toBe(200);
   state.oauth={scope:['studio:read','studio:write']};
   const invoke=async(name:string)=>{
    const response=await mcp(new Request('https://studio.example/mcp',{method:'POST',headers:{Authorization:'Bearer opz1.fixture',Accept:'application/json,text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_profile',arguments:{kind:'persona',name,notes:'',permission:true,references:refs}}})}));
    return response.json();
   };
   expect((await invoke('idea')).result.structuredContent.profile.name).toBe('idea');
   expect((await invoke(' İDEA ')).result.isError).toBe(true);
   expect((await local.query('select name from studio_personas order by name collate "C"')).rows).toEqual([{name:'idea'},{name:'İdea'}]);
  } finally {state.local=undefined;await local.close();}
 },30000);
 it('applies the same uniqueness rule to local profile names, including suffix backfill',async()=>{
  const {assertUniqueProfileName,dedupeProfileNames,profileNameTakenError}=await import('../src/lib/profile-name');
  const existing=[{id:'1',name:'Alice',created_at:'2026-11-01T00:00:00.000Z'}];
  expect(()=>assertUniqueProfileName(existing,'  ALICE  ','persona')).toThrow(profileNameTakenError('persona','ALICE'));
  expect(()=>assertUniqueProfileName([],'Alice','style')).not.toThrow();
  expect(()=>assertUniqueProfileName(existing,'Beatrice','persona')).not.toThrow();
  const rows=[
   {id:'old',name:'  Derrick  ',created_at:'2026-11-01T00:00:00.000Z'},
   {id:'taken',name:'Derrick (2)',created_at:'2026-11-02T00:00:00.000Z'},
   {id:'new',name:'derrick',created_at:'2026-11-03T00:00:00.000Z'},
  ];
  expect(dedupeProfileNames(rows)).toEqual([
   {id:'old',name:'Derrick',created_at:'2026-11-01T00:00:00.000Z'},
   {id:'taken',name:'Derrick (2)',created_at:'2026-11-02T00:00:00.000Z'},
   {id:'new',name:'derrick (3)',created_at:'2026-11-03T00:00:00.000Z'},
  ]);
 });
});

it('preserves save_profile and get_profile MCP result shapes',async()=>{
 const {POST:mcp}=await import('../src/app/mcp/route');
 state.oauth={scope:['studio:read','studio:write']};
 const invoke=async(name:string,args:unknown)=>{
  const response=await mcp(new Request('https://studio.example/mcp',{method:'POST',headers:{Authorization:'Bearer opz1.fixture',Accept:'application/json,text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
  return (await response.json()).result;
 };
 const saved=await invoke('save_profile',{kind:'persona',name:'Alice',notes:'Preserve identity',permission:true,references:refs});
 expect(saved.isError).not.toBe(true);
 expect(Object.keys(saved.structuredContent)).toEqual(['profile','method']);
 expect(saved.structuredContent.profile).toMatchObject({id:'33333333-3333-4333-8333-333333333333',name:'Alice',refs});
 expect(JSON.parse(saved.content[0].text)).toEqual(saved.structuredContent);
 const got=await invoke('get_profile',{kind:'persona',id:saved.structuredContent.profile.id});
 expect(got.isError).not.toBe(true);
 expect(got.structuredContent).toEqual({profile:saved.structuredContent.profile,pictures:refs.map(path=>({path,url:`https://example.test/300/${path}`})),previewExpiresIn:300});
 expect(JSON.parse(got.content[0].text)).toEqual(got.structuredContent);
});
