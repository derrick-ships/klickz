import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
// Same canonical/semanticDigest used by reserveJob in src/lib/jobs.ts (via diagnostics.ts).
function canonical(value:unknown):string{
 if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
 if(value&&typeof value==="object")return "{"+Object.keys(value as object).sort().map(k=>JSON.stringify(k)+":"+canonical((value as Record<string,unknown>)[k])).join(",")+"}";
 return JSON.stringify(value)??"null";
}
const semanticDigest=(value:unknown)=>createHash("sha256").update(canonical(value)).digest("hex");

const A='11111111-1111-4111-8111-111111111111';
const chatA='33333333-3333-4333-8333-333333333333';
const originalId='55555555-5555-4555-8555-555555555555';
const childId='66666666-6666-4666-8666-666666666666';
const secondChildId='77777777-7777-4777-8777-777777777777';
const otherId='99999999-9999-4999-8999-999999999999';
const now='2026-11-10T00:00:00.000Z';

function session(id:string){
 return {access_token:'header.'+Buffer.from(JSON.stringify({sub:id,exp:4102444800})).toString('base64url')+'.signature',refresh_token:'fixture-only-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:'a@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-11-08T00:00:00Z'}};
}

function fixtureScore(title='Account A image'){
 const dimensions=Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:60,confidence:.7,observation:'Fixture observation',strength:'Visible subject',weakness:'Competing text',fix:'Reduce competing text'}]));
 return {source:'jev',version:3,title,overall:60,priority:'clarity',created_at:now,note:'Fixture score. No provider called.',vision:true,fixBlocked:false,warnings:[],
  contributors:[{provider:'Jev',model:'jev-latest',role:'scoring'},{provider:'OpenAI API',model:'fixture',role:'image-review'}],
  dimensions};
}

function fixtureChildScore(title:string){
 return {...fixtureScore(title),overall:78,note:'Fixture child score. No provider called.'};
}

async function setup(page:Page,opts:{model?:'flare'|'gemini-flash'}={}){
 const settings={model:opts.model||'flare',quality:'low',complexity:'low',format:'long',batch:1};
 const chats:any[]=[{id:chatA,user_id:A,title:'Account A chat',draft:{prompt:'A factual thumbnail from account A',settings},created_at:now,updated_at:now}];
 const creations:any[]=[{id:originalId,user_id:A,conversation_id:chatA,title:'Account A image',prompt:'A factual thumbnail from account A',mode:'generate',style:'Auto',persona_id:null,parent_id:null,image_path:A+'/image.png',status:'ready',favorite:false,settings,created_at:now,score:fixtureScore()}];
 const png=await sharp({create:{width:800,height:450,channels:3,background:'#dc384b'}}).png().toBuffer();
 await page.route('**/*',r=>(new URL(r.request().url()).hostname==='127.0.0.1'||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 await page.route('**/api/jobs',r=>r.fulfill({json:{jobs:[]}}));
 await page.addInitScript(({s,A,chatA})=>{localStorage.setItem('sb-test-auth-token',JSON.stringify(s));localStorage.setItem('openpikzels.activeChat.'+A,chatA);},{s:session(A),A,chatA});
 // All three vision keys are connected so the current score plan would prefer Claude.
 // The fixture score was reviewed by OpenAI; the one-click path must keep that provider.
 await page.route('**/api/config',r=>r.fulfill({json:{cloud:true,ai:true,openai:true,jev:true,google:true,anthropic:true,ownerGate:false,supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test'}}));
 await page.route('https://test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(url.pathname.includes('/auth/'))return route.fulfill({json:session(A).user,headers});
  if(url.pathname.includes('/storage/')&&req.method()==='POST'){const paths=req.postDataJSON().paths||[];return route.fulfill({json:paths.map((p:string)=>({path:p,signedURL:'/object/sign/studio-assets/'+p+'?token=fixture'})),headers});}
  if(url.pathname.includes('/storage/'))return route.fulfill({body:png,contentType:'image/png',headers});
  const token=req.headers().authorization?.replace('Bearer ','')||'';let owner=A;try{owner=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;}catch{}
  const table=url.pathname.split('/').pop(),data=table==='studio_conversations'?chats:table==='studio_creations'?creations:[],filter=(v:any)=>v.user_id===owner&&(!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+v.id)&&(!url.searchParams.has('user_id')||url.searchParams.get('user_id')==='eq.'+v.user_id);
  if(req.method()==='POST'&&table==='studio_conversations'){const row=req.postDataJSON();if(row.user_id!==owner)return route.fulfill({status:403,json:{error:'RLS fixture'},headers});const i=chats.findIndex(c=>c.id===row.id);if(i<0)chats.push(row);else chats[i]=row;return route.fulfill({status:201,body:'',headers});}
  const rows=data.filter(filter);return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows,headers});
 });
 return {settings,chats,creations};
}

function recordCalls(page:Page,creations:any[],opts:{holdFixPlan?:Promise<void>;generateOnce?:'network'|'server'|'text504';analyzeOnce?:boolean}={}){
 const calls:string[]=[],generateBodies:any[]=[],analyzeBodies:any[]=[],fixPlanBodies:any[]=[],tokens:string[]=[];
 const originalScore=structuredClone(creations.find((c:any)=>c.id===originalId).score);
 const jobs=new Map<string,{digest:string;result:any}>();
 const childIds=[childId,secondChildId];
 let planSeq=0,generateAttempts=0,nextChild=0;
 page.route('**/api/fix-plan',async r=>{
  const body=r.request().postDataJSON();
  fixPlanBodies.push(body);
  calls.push('fix-plan');
  if(opts.holdFixPlan)await opts.holdFixPlan;
  const token='explicit-ui-fixture-token-'+(++planSeq);
  tokens.push(token);
  return r.fulfill({json:{
   kind:'ready',
   token,
   notice:'One new image-provider request, then a new score. Provider cost depends on your own account; no price estimate or guaranteed fidelity is claimed.',
   plan:{sourceId:body.creationId||originalId,title:creations.find((c:any)=>c.id===(body.creationId||originalId))?.title||'Account A image',videoBrief:'Fixture brief',settings:{model:'flare',quality:'low',batch:1},operations:[{id:'fixture-issue',pillar:'clarity',instruction:'Fixture: make the subject easier to read.',tradeoff:'Fixture: retain all required objects.'}]},
  }});
 });
 page.route('**/api/generate',async r=>{
  const input=r.request().postDataJSON();
  generateBodies.push(input);
  calls.push('generate');
  generateAttempts++;
  if(opts.generateOnce==='network'&&generateAttempts===1)return r.abort('connectionreset');
  if(opts.generateOnce==='text504'&&generateAttempts===1)return r.fulfill({status:504,contentType:'text/plain',body:'An error occurred with your deployment'});
  if(opts.generateOnce==='server'&&generateAttempts===1)return r.fulfill({status:500,json:{error:'Fixture generate failed'}});
  const payload_digest=semanticDigest(input);
  const previous=jobs.get(input.requestId);
  if(previous){
   if(previous.digest!==payload_digest)return r.fulfill({status:409,json:{error:'This request ID was used with different inputs.'}});
   return r.fulfill({json:previous.result});
  }
  const source=creations.find((c:any)=>c.id===input.parentId)||creations.find((c:any)=>c.id===originalId);
  const id=childIds[nextChild++]||crypto.randomUUID();
  const item={...source,id,parent_id:source.id,mode:'fix',score:null,lineage:{origin:'edited',sourceId:source.id},title:input.title,prompt:input.prompt,image_path:A+'/fixed-'+id+'.png',conversation_id:input.conversationId||chatA,created_at:new Date(Date.parse(now)+nextChild).toISOString()};
  creations.unshift(item);
  const result={creations:[item],partial:false};
  jobs.set(input.requestId,{digest:payload_digest,result});
  return r.fulfill({json:result});
 });
 page.route('**/api/analyze',async r=>{
  const input=r.request().postDataJSON();
  analyzeBodies.push(input);
  if(opts.analyzeOnce&&analyzeBodies.length===1)return r.fulfill({status:502,json:{error:'Fixture scoring unavailable'}});
  calls.push('analyze');
  const score=fixtureChildScore(input.title);
  const item=creations.find((c:any)=>c.id===input.creationId);
  if(item)item.score=score;
  return r.fulfill({json:{score,creationId:input.creationId}});
 });
 return {calls,generateBodies,analyzeBodies,fixPlanBodies,tokens,originalScore};
}

test('one click on a scored image creates a child, re-scores with the same vision provider, and leaves the original unchanged',async({page})=>{
 const f=await setup(page);
 const rec=recordCalls(page,f.creations);
 await page.goto('/');
 await expect(page.locator('.score-header')).toContainText('60');
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await expect(fix).toBeEnabled();
 await expect(page.getByRole('link',{name:'Adjust fix first',exact:true})).toBeVisible();
 await fix.click();
 await expect.poll(()=>rec.calls.join(',')).toBe('fix-plan,generate,analyze');
 expect(rec.generateBodies).toHaveLength(1);
 expect(rec.generateBodies[0].mode).toBe('fix');
 expect(rec.generateBodies[0].parentId).toBe(originalId);
 expect(rec.generateBodies[0].fixPlanToken).toBe(rec.tokens[0]);
 expect(rec.generateBodies[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
 expect(rec.analyzeBodies).toHaveLength(1);
 expect(rec.analyzeBodies[0].creationId).toBe(childId);
 expect(rec.analyzeBodies[0].critiqueProvider).toBe('openai');
 expect(rec.analyzeBodies[0].includeVision).toBe(true);
 expect(rec.analyzeBodies[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
 expect(rec.analyzeBodies[0].requestId).not.toBe(rec.generateBodies[0].requestId);
 const child=f.creations.find((c:any)=>c.id===childId);
 expect(child.parent_id).toBe(originalId);
 expect(child.lineage.origin).toBe('edited');
 expect(child.score.overall).toBe(78);
 const original=f.creations.find((c:any)=>c.id===originalId);
 expect(original.score).toEqual(rec.originalScore);
 expect(original.image_path).toBe(A+'/image.png');
 await expect(page.locator('.score-header')).toContainText('78');
 await page.getByRole('button',{name:'View original thumbnail',exact:true}).click();
 await expect(page.locator('.score-header')).toContainText('60');
 expect(f.creations.find((c:any)=>c.id===originalId).score).toEqual(rec.originalScore);
});

test('a double click issues a single call per step with a stable requestId',async({page})=>{
 const f=await setup(page);
 let release!:()=>void;
 const hold=new Promise<void>(r=>release=r);
 const rec=recordCalls(page,f.creations,{holdFixPlan:hold});
 await page.goto('/');
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await expect(fix).toBeEnabled();
 await fix.evaluate((el:HTMLButtonElement)=>{el.click();el.click();});
 release();
 await expect.poll(()=>rec.calls.join(',')).toBe('fix-plan,generate,analyze');
 expect(rec.fixPlanBodies).toHaveLength(1);
 expect(rec.generateBodies).toHaveLength(1);
 expect(rec.analyzeBodies).toHaveLength(1);
 expect(rec.generateBodies[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
 expect(rec.analyzeBodies[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
 expect(rec.analyzeBodies[0].requestId).not.toBe(rec.generateBodies[0].requestId);
 await expect(page.locator('.score-header')).toContainText('78');
});

test('a blocked plan disables the button, shows the reason, and makes no provider call',async({page})=>{
 const f=await setup(page);
 const paid={generate:0,analyze:0};
 await page.route('**/api/fix-plan',r=>r.fulfill({json:{kind:'blocked',reason:'Add factual context and image-specific critique first.'}}));
 await page.route('**/api/generate',r=>{paid.generate++;return r.abort();});
 await page.route('**/api/analyze',r=>{paid.analyze++;return r.abort();});
 await page.goto('/');
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await expect(fix).toBeEnabled();
 await fix.click();
 await expect(page.getByRole('status').filter({hasText:'Add factual context and image-specific critique first.'})).toBeVisible();
 await expect(fix).toBeDisabled();
 expect(paid).toEqual({generate:0,analyze:0});
});

test('the fix-plan notice no longer says no automatic re-analysis and a Gemini model shows the Q8 warning',async({page})=>{
 await setup(page,{model:'gemini-flash'});
 await page.goto('/');
 await expect(page.getByText('Gemini may change more of the image than an OpenAI edit.',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Adjust fix first',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review one-click fix'})).toBeVisible();
 await expect(page.getByText('The new image will not be scored automatically.')).toHaveCount(0);
 await expect(page.getByText('No automatic re-analysis')).toHaveCount(0);
 await expect(page.getByText('The new image is scored after it is created.')).toBeVisible();
 await expect(page.getByText('Gemini may change more of the image than an OpenAI edit.',{exact:true})).toHaveCount(2);
});

test('a second fix on the same source makes a new image',async({page})=>{
 const f=await setup(page);
 const rec=recordCalls(page,f.creations);
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await page.goto('/');
 await fix.click();
 await expect(page.locator('.score-header')).toContainText('78');
 await page.getByRole('button',{name:'View original thumbnail',exact:true}).click();
 await expect(page.locator('.score-header')).toContainText('60');
 await expect(fix).toBeEnabled();
 await fix.click();
 await expect(page.locator('.score-header')).toContainText('78');
 expect(rec.generateBodies).toHaveLength(2);
 expect(rec.fixPlanBodies).toHaveLength(2);
 expect(rec.generateBodies[1].requestId).not.toBe(rec.generateBodies[0].requestId);
 expect(rec.generateBodies[1].fixPlanToken).toBe(rec.tokens[1]);
 expect(rec.generateBodies[1].fixPlanToken).not.toBe(rec.generateBodies[0].fixPlanToken);
 expect(rec.generateBodies[1].parentId).toBe(originalId);
 const children=f.creations.filter((c:any)=>c.parent_id===originalId);
 expect(children).toHaveLength(2);
 expect(new Set(children.map((c:any)=>c.id))).toEqual(new Set([childId,secondChildId]));
});

test('after a network failure the retry reuses the same request id and token',async({page})=>{
 const f=await setup(page);
 const rec=recordCalls(page,f.creations,{generateOnce:'network'});
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await page.goto('/');
 await fix.click();
 await expect(page.getByRole('alert').filter({hasText:'Failed to fetch'})).toBeVisible();
 await expect(fix).toBeEnabled();
 await fix.click();
 await expect(page.locator('.score-header')).toContainText('78');
 expect(rec.fixPlanBodies).toHaveLength(1);
 expect(rec.generateBodies).toHaveLength(2);
 expect(rec.generateBodies[1].requestId).toBe(rec.generateBodies[0].requestId);
 expect(rec.generateBodies[1].fixPlanToken).toBe(rec.generateBodies[0].fixPlanToken);
 expect(rec.generateBodies[0].fixPlanToken).toBe(rec.tokens[0]);
});

test('after a server failure the next click works',async({page})=>{
 const f=await setup(page);
 const rec=recordCalls(page,f.creations,{generateOnce:'server'});
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await page.goto('/');
 await fix.click();
 await expect(page.getByRole('alert').filter({hasText:'Fixture generate failed'})).toBeVisible();
 await expect(fix).toBeEnabled();
 await fix.click();
 await expect(page.locator('.score-header')).toContainText('78');
 expect(rec.fixPlanBodies).toHaveLength(2);
 expect(rec.generateBodies).toHaveLength(2);
 expect(rec.generateBodies[1].requestId).not.toBe(rec.generateBodies[0].requestId);
 expect(rec.generateBodies[1].fixPlanToken).toBe(rec.tokens[1]);
 expect(rec.generateBodies[1].fixPlanToken).not.toBe(rec.generateBodies[0].fixPlanToken);
});

test('a blocked result on one image does not disable Fix on another',async({page})=>{
 const f=await setup(page);
 f.creations.push({...f.creations[0],id:otherId,title:'Account A second image',prompt:'A second scored thumbnail',image_path:A+'/image-b.png',created_at:'2026-11-09T00:00:00.000Z',score:fixtureScore('Account A second image')});
 await page.route('**/api/fix-plan',async r=>{
  const body=r.request().postDataJSON();
  if(body.creationId===originalId)return r.fulfill({json:{kind:'blocked',reason:'Add factual context and image-specific critique first.'}});
  return r.fulfill({json:{kind:'ready',token:'explicit-ui-fixture-other',notice:'Fixture ready',plan:{sourceId:body.creationId,title:'Account A second image',videoBrief:'Fixture brief',settings:{model:'flare',quality:'low',batch:1},operations:[{id:'fixture-issue',pillar:'clarity',instruction:'Fixture edit.',tradeoff:'Fixture tradeoff.'}]}}});
 });
 await page.route('**/api/generate',r=>r.abort());
 await page.route('**/api/analyze',r=>r.abort());
 await page.goto('/');
 await expect(page.locator('.review-summary')).toContainText('Account A image');
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await fix.click();
 await expect(page.getByRole('status').filter({hasText:'Add factual context and image-specific critique first.'})).toBeVisible();
 await expect(fix).toBeDisabled();
 await page.getByRole('button',{name:'Open Account A second image',exact:true}).click();
 await expect(page.locator('.review-summary')).toContainText('Account A second image');
 await expect(page.getByRole('status').filter({hasText:'Add factual context and image-specific critique first.'})).toHaveCount(0);
 await expect(fix).toBeEnabled();
});

test('after scoring fails the child stays selected and Retry score reuses the analyze request id',async({page})=>{
 const f=await setup(page);
 const rec=recordCalls(page,f.creations,{analyzeOnce:true});
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await page.goto('/');
 await fix.click();
 await expect.poll(()=>rec.generateBodies.length).toBe(1);
 await expect.poll(()=>rec.analyzeBodies.length).toBe(1);
 await expect(page.getByLabel('Scoring inspector')).toContainText('Score did not finish');
 await expect(page.getByRole('button',{name:'Retry score',exact:true})).toBeVisible();
 expect(f.creations.filter((c:any)=>c.parent_id===originalId)).toHaveLength(1);
 await page.getByRole('button',{name:'Retry score',exact:true}).click();
 await expect.poll(()=>rec.analyzeBodies.length).toBe(2);
 expect(rec.analyzeBodies[0].requestId).toBe(rec.analyzeBodies[1].requestId);
 expect(rec.analyzeBodies[0].creationId).toBe(childId);
 expect(rec.generateBodies).toHaveLength(1);
 expect(f.creations.filter((c:any)=>c.parent_id===originalId)).toHaveLength(1);
 await expect(page.locator('.score-header')).toContainText('78');
});

test('after a 504 text response the retry reuses the same request id and token',async({page})=>{
 const f=await setup(page);
 const rec=recordCalls(page,f.creations,{generateOnce:'text504'});
 const fix=page.getByRole('button',{name:"Fix what's holding it back",exact:true});
 await page.goto('/');
 await fix.click();
 await expect.poll(()=>rec.generateBodies.length).toBe(1);
 await expect(fix).toBeEnabled();
 await fix.click();
 await expect.poll(()=>rec.generateBodies.length).toBe(2);
 expect(rec.fixPlanBodies).toHaveLength(1);
 expect(rec.generateBodies[0].requestId).toBe(rec.generateBodies[1].requestId);
 expect(rec.generateBodies[0].fixPlanToken).toBe(rec.generateBodies[1].fixPlanToken);
 expect(rec.generateBodies[0].fixPlanToken).toBe(rec.tokens[0]);
 await expect(page.locator('.score-header')).toContainText('78');
});
