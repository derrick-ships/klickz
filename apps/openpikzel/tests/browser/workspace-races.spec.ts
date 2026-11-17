import {test,expect,type Page} from '@playwright/test';
import { openMoreOptions, openResultMore } from "./helpers/more-options";
import sharp from 'sharp';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',chatA='33333333-3333-4333-8333-333333333333',chatB='44444444-4444-4444-8444-444444444444';
function session(id:string){return {access_token:'header.'+Buffer.from(JSON.stringify({sub:id,exp:4102444800})).toString('base64url')+'.signature',refresh_token:'fixture-only-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:id===A?'a@example.test':'b@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-11-08T00:00:00Z'}};}
async function settleResponsiveNavigation(page:Page,width:number,height:number){
 await page.setViewportSize({width,height});
 if(width<=1024){
  await expect(page.locator('aside.sidebar')).toBeHidden();
  await expect(page.locator('.workspace-main')).not.toHaveAttribute('inert','');
  await expect(page.locator('.workspace-main')).toHaveCSS('filter','none');
 }else await expect(page.locator('aside.sidebar')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function setup(page:Page){
 await page.route('**/*',r=>(new URL(r.request().url()).hostname==='127.0.0.1'||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 const settings={model:'flare',quality:'low',complexity:'low',format:'long',batch:1},now=new Date().toISOString(),chats:any[]=[{id:chatA,user_id:A,title:'Account A chat',draft:{prompt:'A factual thumbnail from account A',settings},created_at:now,updated_at:now},{id:chatB,user_id:B,title:'Account B chat',draft:{prompt:'A separate private account B draft',settings},created_at:now,updated_at:now}],creations:any[]=[{id:'55555555-5555-4555-8555-555555555555',user_id:A,conversation_id:chatA,title:'Account A image',prompt:'A factual thumbnail from account A',mode:'generate',style:'Auto',persona_id:null,parent_id:null,image_path:A+'/image.png',status:'ready',favorite:false,settings,created_at:now}];
 chats.push({id:'88888888-8888-4888-8888-888888888888',user_id:A,title:'Account A other chat',draft:{prompt:'Another A project'},created_at:now,updated_at:now});
 await page.route('**/api/jobs',r=>r.fulfill({json:{jobs:[]}}));
 const png=await sharp({create:{width:800,height:450,channels:3,background:'#dc384b'}}).png().toBuffer();
 await page.addInitScript(({s,A,chatA,B,chatB})=>{localStorage.setItem('sb-test-auth-token',JSON.stringify(s));localStorage.setItem('openpikzels.activeChat.'+A,chatA);localStorage.setItem('openpikzels.activeChat.'+B,chatB);},{s:session(A),A,chatA,B,chatB});
 await page.route('**/api/config',r=>r.fulfill({json:{cloud:true,ai:true,openai:true,jev:true,google:false,ownerGate:false,supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test'}}));
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

 await page.route('**/api/analyze',async r=>{
  const input=r.request().postDataJSON(),item=creations.find(c=>c.id===input.creationId);
  const score={source:'jev',version:3,title:input.title,overall:null,partial:true,priority:'clarity',created_at:now,note:'Explicit test fixture; no provider called.',vision:true,fixBlocked:true,
    dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:null,confidence:0,missingReason:'Fixture has no measured assessment',observation:'Fixture only',strength:'',weakness:'',fix:''}]))};
  if(item)item.score=score;return r.fulfill({json:{score,creationId:input.creationId}});
 });

 return {settings,chats,creations};
}
for(const width of [1440,390])test('unscored image scores directly above the fold at '+width,async({page})=>{
 const f=await setup(page);await page.setViewportSize({width,height:width===390?844:900});let calls=0;await page.route('**/api/analyze',r=>{calls++;expect(r.request().postDataJSON().creationId).toBe(f.creations[0].id);return r.fulfill({status:502,json:{error:'Explicit fixture response'}});});await page.goto('/');
 const action=page.getByRole('button',{name:'Score thumbnail',exact:true});await expect(action).toHaveClass(/primary-button/);const box=(await action.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(page.viewportSize()!.height);await page.screenshot({path:'evidence/score-first-'+width+'.png'});await action.click();await expect.poll(()=>calls).toBe(1);await expect(page.locator('.error-banner')).toContainText('Explicit fixture response');
});
test('busy generation cannot switch chats through library navigation',async({page})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/generate',async route=>{entered();await hold;const result={...f.creations[0],id:'66666666-6666-4666-8666-666666666666',title:'Completed in account A',created_at:new Date().toISOString()};f.creations.unshift(result);await route.fulfill({json:{creations:[result],partial:false}});});
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();await waiting;
 await expect(page.getByRole('button',{name:'My creations',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Open chat: Account A other chat',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'My creations',exact:true}).evaluate((e:HTMLButtonElement)=>e.click());await expect(page.locator('.chat-title')).toContainText('Account A chat');release();await expect(page.getByRole('heading',{name:'Your thumbnail.',exact:true})).toBeVisible();await expect(page.locator('.review-summary')).toContainText('Completed in account A');
 expect(f.chats.find(c=>c.id===chatB).draft.prompt).toBe('A separate private account B draft');
});
test('delayed account A resize cannot overwrite account B hydration or draft',async({page,context})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/generate',async route=>{entered();await hold;await route.fulfill({json:{creations:[{...f.creations[0],id:'77777777-7777-4777-8777-777777777777',mode:'edit',parent_id:f.creations[0].id,settings:{...f.settings,format:'short'}}],partial:false}});});
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await openResultMore(page);await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();await waiting;
 await page.evaluate(s=>{localStorage.setItem('sb-test-auth-token',JSON.stringify(s));const bc=new BroadcastChannel('sb-test-auth-token');bc.postMessage({event:'SIGNED_IN',session:s});setTimeout(()=>bc.close(),100);},session(B));
 await expect(page.locator('.chat-title')).toContainText('Account B chat');release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await expect(page.getByRole('alert').filter({hasText:'Your account changed'})).toHaveCount(0);await expect(page.locator('.chat-title')).toContainText('Account B chat');await expect(page.getByLabel('Describe your thumbnail',{exact:true})).toHaveValue('A separate private account B draft');
 expect(f.chats.find(c=>c.id===chatB).draft.prompt).toBe('A separate private account B draft');
});

test('explicit save cannot overwrite newer edits already checkpointed during a slow creation write',async({page})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('https://test.supabase.co/rest/v1/studio_creations*',async route=>{if(route.request().method()!=='POST')return route.fallback();entered();await hold;f.creations.push(route.request().postDataJSON());await route.fulfill({status:201,body:'',headers:{'access-control-allow-origin':'*'}});});
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByLabel('Describe your thumbnail',{exact:true}).fill('The first submitted image concept');await page.getByRole('button',{name:'Save draft',exact:true}).click();await waiting;
 await page.getByLabel('Describe your thumbnail',{exact:true}).fill('The newer edited concept must survive');await expect.poll(()=>f.chats.find(c=>c.id===chatA).draft.prompt).toBe('The newer edited concept must survive');release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await page.reload();await expect(page.getByLabel('Describe your thumbnail',{exact:true})).toHaveValue('The newer edited concept must survive');
});


test('typing while generation runs preserves new direction and offers a result without stealing focus',async({page})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/generate',async route=>{entered();await hold;const result={...f.creations[0],id:'66666666-6666-4666-8666-666666666666',title:'Completed result',created_at:new Date().toISOString()};f.creations.unshift(result);await route.fulfill({json:{creations:[result],partial:false}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();await waiting;
 const prompt=page.getByLabel('Describe your thumbnail',{exact:true});await prompt.fill('My next idea must stay open while this result finishes');release();
 await expect(page.getByRole('button',{name:'View result',exact:true})).toBeVisible();await expect(prompt).toHaveValue('My next idea must stay open while this result finishes');await expect(prompt).toBeFocused();
 await page.reload();await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await expect(prompt).toHaveValue('My next idea must stay open while this result finishes');
});
test('request activity is reachable inside its modal and refresh never resubmits a request',async({page})=>{
 const f=await setup(page);let reads=0,paid=0,complete=false;
 await page.route('**/api/jobs',r=>{reads++;return r.fulfill({json:{jobs:[{id:'fixture-request',operation:'generate',state:complete?'succeeded':'reconciling',max_provider_calls:1,created_at:'2026-11-09T12:00:00Z',result:complete?{creation:{id:f.creations[0].id}}:null}]}});});
 await page.route('**/api/generate',r=>{paid++;return r.abort();});await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');
 await page.getByRole('button',{name:'Connections',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'View API activity',exact:true}).click();await expect(dialog).toContainText('Outcome uncertain');
 complete=true;await dialog.getByRole('button',{name:'Refresh activity',exact:true}).focus();await page.keyboard.press('Enter');await expect(dialog).toContainText('Completed');
 await dialog.getByRole('button',{name:'Open saved result',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('.review-summary')).toContainText('Account A image');expect(reads).toBeGreaterThanOrEqual(3);expect(paid).toBe(0);
});
test('slow first autosave cannot steal a subsequently selected chat',async({page})=>{
 const f=await setup(page);await page.addInitScript(({A})=>localStorage.removeItem('openpikzels.activeChat.'+A),{A});
 let release!:()=>void,entered!:()=>void,held=false;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('https://test.supabase.co/rest/v1/studio_conversations*',async r=>{if(r.request().method()==='POST'&&!held){held=true;entered();await hold;}await r.fallback();});
 await page.goto('/');await expect(page.getByRole('button',{name:'Open chat: Account A other chat',exact:true})).toBeVisible();await page.getByLabel('Describe your thumbnail',{exact:true}).fill('Detached first draft must still be saved');await waiting;
 await page.getByLabel('Describe your thumbnail',{exact:true}).fill('Latest detached revision must still be saved');
 const navigation=page.getByRole('button',{name:'Open chat: Account A other chat',exact:true}).click();release();await navigation;await expect(page.locator('.chat-title')).toContainText('Account A other chat');
 await expect.poll(()=>f.chats.some(c=>c.draft.prompt==='Latest detached revision must still be saved')).toBe(true);
 await expect(page.locator('.chat-title')).toContainText('Account A other chat');await expect(page.getByLabel('Describe your thumbnail',{exact:true})).toHaveValue('Another A project');
});

async function switchAccount(page:Page,id:string){
 await page.evaluate(s=>{localStorage.setItem('sb-test-auth-token',JSON.stringify(s));const channel=new BroadcastChannel('sb-test-auth-token');channel.postMessage({event:'SIGNED_IN',session:s});setTimeout(()=>channel.close(),100);},session(id));
 await expect(page.locator('.chat-title')).toContainText(id===A?'Account A chat':'Account B chat');
}
test('stale comparison cannot reopen another account image dialog',async({page})=>{
 const f=await setup(page);f.creations[0].parent_id='99999999-9999-4999-8999-999999999999';f.creations[0].mode='fix';
 let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/compare',async r=>{entered();await hold;await r.fulfill({json:{token:'fixture',a:{url:'/fixture-private-A.png'},b:{url:'/fixture-private-B.png'}}});});
 await page.goto('/');await page.getByRole('button',{name:'Compare without scores',exact:true}).click();await waiting;await switchAccount(page,B);release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('.chat-title')).toContainText('Account B chat');
});
test('composer locks while a slow chat navigation saves then restores editable destination',async({page})=>{
 await setup(page);await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();const prompt=page.getByLabel('Describe your thumbnail',{exact:true});await prompt.fill('Preserve this brief before the chat changes');
 let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('https://test.supabase.co/rest/v1/studio_conversations*',async r=>{if(r.request().method()==='POST'){entered();await hold;}await r.fallback();});
 await page.getByRole('button',{name:'Open chat: Account A other chat',exact:true}).click();await waiting;
 await expect(prompt).toBeDisabled();await expect(page.getByRole('tab',{name:'Score',exact:true})).toBeDisabled();release();
 await expect(page.locator('.chat-title')).toContainText('Account A other chat');await expect(prompt).toBeEnabled();await expect(prompt).toHaveValue('Another A project');
});

test('reselecting the active chat preserves an unsent prompt',async({page})=>{
 const f=await setup(page);await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 const prompt=page.getByLabel('Describe your thumbnail',{exact:true});await prompt.fill('This latest brief must survive clicking my current chat');
 await page.screenshot({path:'evidence/loop-v2-active-chat-before.png',fullPage:true});
 await page.getByRole('button',{name:'Open chat: Account A chat',exact:true}).click();
 await expect(page.locator('.operation-progress')).toHaveCount(0);
 await page.screenshot({path:'evidence/loop-v2-active-chat-result.png',fullPage:true});
 await expect(prompt).toHaveValue('This latest brief must survive clicking my current chat');
 await expect.poll(()=>f.chats.find(c=>c.id===f.chats[0].id)?.draft.prompt).toBe('This latest brief must survive clicking my current chat');
 await page.reload();await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 await expect(page.getByLabel('Describe your thumbnail',{exact:true})).toHaveValue('This latest brief must survive clicking my current chat');
});

test('ready actions describe each task and generated labels never become video titles',async({page})=>{
 const f=await setup(page);let generated:any=null;
 await page.route('**/api/generate',async route=>{generated=route.request().postDataJSON();const item={...f.creations[0],id:'66666666-6666-4666-8666-666666666666',title:generated.prompt.slice(0,80)};f.creations.unshift(item);await route.fulfill({json:{creations:[item],partial:false}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 await expect(page.getByRole('button',{name:'Create thumbnail',exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:'Edit',exact:true})).toHaveCount(0);await expect(page.getByRole('tab',{name:'Remix',exact:true})).toHaveCount(0);await expect(page.getByRole('tab',{name:'Titles',exact:true})).toHaveCount(0);
 await page.route('**/api/analyze',r=>r.fulfill({status:502,json:{error:'Fixture scoring unavailable'}}));
 await page.getByRole('tab',{name:'Create',exact:true}).click();await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your thumbnail.',exact:true})).toBeVisible();
 expect(generated.title).toBe('');
 await expect(page.getByRole('button',{name:'Retry score',exact:true})).toBeVisible();
});

test('ready image without a preview offers only a read refresh',async({page})=>{
 const f=await setup(page);f.creations[0].image_path=null;let paid=0;await page.route('**/api/generate',r=>{paid++;return r.abort();});
 await page.goto('/');await expect(page.getByText('This image preview is unavailable. Refresh the preview to check again.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Refresh preview',exact:true}).click();await expect(page.locator('.operation-progress')).toHaveCount(0);expect(paid).toBe(0);
});
test('connection lookup distinguishes loading and failure from disconnected and recovers without a write',async({page})=>{
 await setup(page);let release!:()=>void;const hold=new Promise<void>(r=>release=r);let reads=0,writes=0;
 await page.route('**/api/providers',async r=>{if(r.request().method()!=='GET')writes++;reads++;if(reads===1){await hold;return r.fulfill({status:503,json:{error:'Fixture lookup unavailable'}});}return r.fulfill({json:{connections:[]}});});
 await page.route('**/api/oauth/grants',r=>r.fulfill({json:{grants:[]}}));
 await page.goto('/connect');
 const cards=page.locator('.provider-grid article');
 await expect(cards).toHaveCount(5);
 const providerCount=await cards.count();
 await expect(page.getByText('Checking connections…',{exact:true})).toHaveCount(providerCount);await expect(page.getByText('Loading connected agents…',{exact:true})).toBeVisible();
 await expect(page.getByText('Not connected',{exact:true})).toHaveCount(0);release();
 await expect(page.getByText('Connection status unavailable. Refresh to check.',{exact:true})).toBeVisible();await expect(page.getByText('No agents connected yet.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Refresh connections',exact:true}).click();await expect(page.getByText('Not connected',{exact:true})).toHaveCount(providerCount);await expect(page.getByText('No agents connected yet.',{exact:true})).toBeVisible();expect(writes).toBe(0);
});

test('analysis scanner waits for a saved result and includes explicitly requested visual guidance',async({page})=>{
 const f=await setup(page);await page.clock.install();let release!:()=>void;const hold=new Promise<void>(r=>release=r);let calls=0;
 await page.route('**/api/analyze',async route=>{
  calls++;const input=route.request().postDataJSON();expect(input.includeVision).toBe(true);expect(input.videoBrief).toBe("");expect(input.videoUrl).toBe("https://youtu.be/abcdefghijk");
  await hold;
  const score={source:"jev",version:3,title:input.title,overall:67,priority:"clarity",created_at:new Date().toISOString(),note:"Explicit fixture; no providers called.",vision:true,fixBlocked:false,
   contributors:[{provider:"Jev",model:"fixture",role:"scoring"},{provider:"OpenAI API",model:"fixture",role:"image-review"}],
   warnings:["The video itself was not watched."],dimensions:Object.fromEntries(["virality","clarity","idea","curiosity","emotion"].map(p=>[p,{score:67,confidence:.7,observation:"Fixture image evidence",strength:"One subject",weakness:"Small text",fix:"Simplify text"}]))};
  f.creations[0].score=score;await route.fulfill({json:{score,creationId:f.creations[0].id}});
 });
 await page.goto('/');await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();await page.getByRole('tab',{name:'Score',exact:true}).click();
 await page.getByLabel('Video title',{exact:true}).fill('A factual studio rebuild');
 await openMoreOptions(page);await page.getByLabel('YouTube video link (optional)',{exact:true}).fill('https://youtu.be/abcdefghijk');await page.getByLabel('Review the image itself for specific advice (one extra AI request)',{exact:true}).check();
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 const scanner=page.getByRole('region',{name:'Thumbnail analysis activity'});
 await expect(scanner).toHaveAttribute('data-phase','running');
 await page.clock.fastForward(60000);
 expect(Number((await scanner.locator('.scanner-counter').innerText()).split('/')[0])).toBeLessThan(100);
 await expect(scanner).toContainText('not measured progress');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await scanner.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:'evidence/scanner-active-'+width+'.png'});}
 await page.emulateMedia({reducedMotion:"reduce"});
 await expect.poll(()=>scanner.locator('.scanner-sweep').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 release();await expect(page.getByRole('dialog')).toContainText('OpenPikzels Score');
 await expect(page.locator('.analysis-scanner')).toHaveAttribute('data-phase','succeeded');
 await expect(page.locator('.analysis-scanner .scanner-counter')).toContainText('100');
 await expect(page.getByRole('dialog')).toContainText('OpenAI API');expect(calls).toBe(1);
});

test('failed analysis never shows completion and retries keep the same request identity',async({page})=>{
 await setup(page);const ids:string[]=[];
 await page.route('**/api/analyze',r=>{ids.push(r.request().postDataJSON().requestId);return r.fulfill({status:502,json:{error:"Fixture analysis could not finish"}});});
 await page.goto('/');await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();await page.getByRole('tab',{name:'Score',exact:true}).click();await page.getByLabel('Video title',{exact:true}).fill('Actual video title');
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 const scanner=page.getByRole('region',{name:'Thumbnail analysis activity'});
 await expect(scanner).toHaveAttribute('data-phase','failed');await expect(scanner).toContainText('check saved results before retrying');
 expect(Number((await scanner.locator('.scanner-counter').innerText()).split('/')[0])).toBeLessThan(100);
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);await expect(scanner).toHaveAttribute('data-phase','failed');
 await expect(page.locator('.score-count')).toHaveCount(0);
});

test('a fresh analysis counts up once in its dialog, then the score panel shows it still',async({page})=>{
 const f=await setup(page);let release!:()=>void;const hold=new Promise<void>(r=>release=r);
 await page.addInitScript(()=>{const w=window as any;w.__counts=[];new MutationObserver(()=>{for(const el of document.querySelectorAll('.score-count')){const where=el.closest('.score-panel')?'panel':'dialog',pad=el.querySelector('.score-count-pad')?.textContent||'',row=where+'|'+(el.getAttribute('aria-hidden')||'-')+'|'+(el.textContent||'').slice(pad.length);if(w.__counts.at(-1)!==row)w.__counts.push(row);}}).observe(document,{subtree:true,childList:true,characterData:true,attributes:true});});
 await page.route('**/api/analyze',async route=>{
  const input=route.request().postDataJSON();await hold;
  const score={source:'jev',version:3,title:input.title,overall:67,priority:'clarity',created_at:new Date().toISOString(),note:'Explicit fixture; no providers called.',vision:false,fixBlocked:true,
   dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:67,confidence:.7,observation:'Fixture',strength:'Fixture',weakness:'Fixture',fix:'Fixture'}]))};
  f.creations[0].score=score;await route.fulfill({json:{score,creationId:f.creations[0].id}});
 });
 await page.goto('/');await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();await page.getByRole('tab',{name:'Score',exact:true}).click();await page.getByLabel('Video title',{exact:true}).fill('A factual studio rebuild');
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 await expect(page.getByRole('region',{name:'Thumbnail analysis activity'})).toHaveAttribute('data-phase','running');
 await expect(page.locator('.score-count')).toHaveCount(0);
 release();
 const ring=page.getByRole('dialog').locator('.score-ring');
 await expect(ring.locator('strong')).toHaveText('67/100');await expect(ring).toHaveAttribute('aria-label','67 out of100');
 await expect(ring.locator('.score-count')).not.toHaveAttribute('aria-hidden',/.*/);
 const dialogTicks=(await page.evaluate(()=>(window as any).__counts as string[])).filter(r=>r.startsWith('dialog|true|')).map(r=>Number(r.split('|')[2]));
 expect(dialogTicks.length).toBeGreaterThan(2);expect(dialogTicks[0]).toBeLessThan(20);expect(Math.max(...dialogTicks)).toBeLessThanOrEqual(67);expect(dialogTicks.filter(v=>v<67).length).toBeGreaterThan(1);
 // The dialog has its own polite region (the page behind the modal is inert); the panel region stays silent, so nothing is announced twice.
 await expect(page.getByRole('dialog').locator('[data-score-announcer]')).toHaveText('OpenPikzels Score 67 out of 100');
 await expect(page.locator('[data-score-announcer]').filter({hasText:'OpenPikzels'})).toHaveCount(1);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();
 const panel=page.getByRole('complementary',{name:'Scoring inspector'});
 await expect(panel.locator('.score-header h2')).toHaveText('67/100');await expect(panel).toHaveAttribute('data-reveal','settled');
 await page.waitForTimeout(900);
 expect((await page.evaluate(()=>(window as any).__counts as string[])).filter(r=>r.startsWith('panel|true|'))).toEqual([]);
 await expect(page.locator('[data-score-announcer]')).toHaveCount(1);await expect(page.locator('[data-score-announcer]')).toHaveText('');
});

test('AI resize dispatches one source-based recomposition and retains the original and draft',async({page})=>{
 const f=await setup(page),original={...f.creations[0]};let calls=0,submitted:any;
 await page.route('**/api/generate',async r=>{
  calls++;const input=r.request().postDataJSON();submitted=input;expect(input.mode).toBe("edit");expect(input.parentId).toBe(original.id);expect(input.referencePaths).toEqual([original.image_path]);
  expect(input.settings.format).toBe("short");expect(input.settings.batch).toBe(1);expect(input.prompt).toContain("vertical 9:16");expect(input.prompt).toContain("Do not merely crop");
  const copy={...original,id:"77777777-7777-4777-8777-777777777777",mode:"edit",parent_id:original.id,settings:input.settings,prompt:input.prompt};f.creations.unshift(copy);
  await r.fulfill({json:{creations:[copy],partial:false}});
 });
 await page.goto('/');await openResultMore(page);await expect(page.getByRole('button',{name:'AI resize to short-form',exact:true})).toHaveAttribute('title',/uses credits/);
 await openResultMore(page);await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
 await openResultMore(page);await expect(page.getByRole('button',{name:'AI resize to long-form',exact:true})).toBeVisible();expect(calls).toBe(1);expect(submitted.title).toBe(original.title);
 expect(f.creations.find(c=>c.id===original.id)).toEqual(original);
 expect(f.chats.find(c=>c.id===chatA).draft.prompt).toBe('A factual thumbnail from account A');
});

test('failed AI resize preserves the source and never falls back to a padded image',async({page})=>{
 const f=await setup(page);let fallback=0;const ids:string[]=[];
 await page.route('**/api/resize',r=>{fallback++;return r.abort();});
 await page.route('**/api/generate',r=>{ids.push(r.request().postDataJSON().requestId);return r.fulfill({status:502,json:{error:"Fixture generation unavailable"}});});
 await page.goto('/');await openResultMore(page);await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Fixture generation unavailable'})).toBeVisible();
 await openResultMore(page);await expect(page.getByRole('button',{name:'AI resize to short-form',exact:true})).toBeEnabled();
 await openResultMore(page);await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
 await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);expect(fallback).toBe(0);expect(f.creations).toHaveLength(1);
});

test('analysis retry reuses the job after a successful response but failed library refresh',async({page})=>{
 const f=await setup(page);const ids:string[]=[];let failRefresh=false;
 await page.route('https://test.supabase.co/rest/v1/studio_creations*',async r=>{
  if(failRefresh && r.request().method()==='GET'){failRefresh=false;return r.fulfill({status:400,json:{message:'Fixture refresh failed'},headers:{'access-control-allow-origin':'*'}});}
  return r.fallback();
 });
 await page.route('**/api/analyze',async r=>{
  ids.push(r.request().postDataJSON().requestId);if(ids.length===1)failRefresh=true;
  const score={source:'jev',version:3,title:'A factual title',overall:60,priority:'clarity',created_at:new Date().toISOString(),note:'Fixture; no providers called.',vision:false,fixBlocked:true,
   dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:60,confidence:.5,observation:'Fixture',strength:'Fixture',weakness:'Fixture',fix:'Fixture'}]))};
  f.creations[0].score=score;return r.fulfill({json:{score,creationId:f.creations[0].id}});
 });
 await page.goto('/');await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();await page.getByRole('tab',{name:'Score',exact:true}).click();await page.getByLabel('Video title',{exact:true}).fill('A factual title');
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 await expect(page.locator('.analysis-scanner')).toHaveAttribute('data-phase','failed');
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 await expect.poll(()=>ids.length).toBe(2);expect(ids[1]).toBe(ids[0]);
 await expect(page.getByRole('dialog')).toContainText('OpenPikzels Score');
});

test('generation reveals its saved image while automatic analysis is still pending',async({page})=>{
 const f=await setup(page);let releaseImage!:()=>void,releaseScore!:()=>void;const imageHold=new Promise<void>(r=>releaseImage=r),scoreHold=new Promise<void>(r=>releaseScore=r);let imageCalls=0,scoreCalls=0;
 await page.route('**/api/generate',async r=>{imageCalls++;await imageHold;const input=r.request().postDataJSON(),item={...f.creations[0],id:'99999999-9999-4999-8999-999999999999',prompt:input.prompt,title:input.title||'Fixture new image'};f.creations.unshift(item);return r.fulfill({json:{creations:[item],partial:false}});});
 await page.route('**/api/analyze',async r=>{scoreCalls++;await scoreHold;return r.fallback();});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();
 const activity=page.getByRole('region',{name:'Thumbnail delivery'});await expect(activity).toHaveAttribute('data-stage','generating');
 for(const width of [1440,390,320]){await settleResponsiveNavigation(page,width,900);await activity.scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/delivery-generating-'+width+'.png'});}
 await page.emulateMedia({reducedMotion:'reduce'});await expect(activity.locator('.delivery-light')).toHaveCSS('animation-name','none');
 releaseImage();await expect(activity).toHaveAttribute('data-stage','analyzing');await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();expect(scoreCalls).toBe(1);
 releaseScore();await expect(activity).toHaveAttribute('data-stage','ready');expect(imageCalls).toBe(1);
});

test('automatic review failure leaves the new image saved without regenerating',async({page})=>{
 const f=await setup(page);let images=0,scores=0;const ids:string[]=[];
 await page.route('**/api/generate',async r=>{images++;const item={...f.creations[0],id:'99999999-9999-4999-8999-999999999999'};f.creations.unshift(item);return r.fulfill({json:{creations:[item],partial:false}});});
 await page.route('**/api/analyze',r=>{scores++;ids.push(r.request().postDataJSON().requestId);return r.fulfill({status:502,json:{error:'Fixture scoring unavailable'}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await openResultMore(page);await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
 await expect(page.getByRole('region',{name:'Thumbnail delivery'})).toHaveAttribute('data-stage','review-pending');
 expect(f.creations).toHaveLength(2);expect(images).toBe(1);expect(scores).toBe(1);await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();
 await expect(page.getByLabel('Scoring inspector')).toContainText('Score did not finish');
 await page.getByRole('button',{name:'Retry score',exact:true}).click();
 await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);
});






test('generate always requests a score when Jev is connected',async({page})=>{
 const f=await setup(page);let reviews=0,generates=0,analyzeBody:any;
 const score={source:'jev',version:3,title:'A factual title',overall:60,priority:'clarity',created_at:new Date().toISOString(),note:'Fixture',vision:true,fixBlocked:true,
  contributors:[{provider:'Jev',model:'fixture',role:'scoring'},{provider:'OpenAI API',model:'fixture',role:'image-review'}],
  dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:60,confidence:.7,observation:'Fixture',strength:'',weakness:'',fix:''}]))};
 await page.route('**/api/analyze',r=>{reviews++;analyzeBody=r.request().postDataJSON();const item=f.creations.find(c=>c.id===analyzeBody.creationId);if(item)item.score=score;return r.fulfill({json:{score,creationId:analyzeBody.creationId}});});
 await page.route('**/api/generate',r=>{generates++;const item={...f.creations[0],id:'99999999-9999-4999-8999-999999999999',score:null};f.creations.unshift(item);return r.fulfill({json:{creations:[item],partial:false}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 await expect(page.getByLabel('Analyze new images automatically')).toHaveCount(0);
 await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();
 await expect.poll(()=>reviews).toBe(1);expect(generates).toBe(1);
 expect(analyzeBody.includeVision).toBe(true);expect(analyzeBody.critiqueProvider).toBe('openai');
 await expect(page.getByRole('region',{name:'Thumbnail delivery'})).toHaveAttribute('data-stage','ready');
 await expect(page.getByLabel('Scoring inspector')).toContainText('Reviewed by OpenAI');
});

test('text and image review providers require explicit selection and survive reload',async({page})=>{
 await setup(page);let calls=0;
 await page.route('**/api/config',r=>r.fulfill({json:{cloud:true,ai:true,openai:false,google:true,jev:true,ownerGate:false,supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test',textModels:{openai:'OpenAI fixture',google:'Google fixture'}}}));
 await page.route('**/api/creative',r=>{calls++;expect(r.request().postDataJSON().provider).toBe('google');return r.fulfill({json:{model:'Google fixture',value:{prompt:'A revised factual thumbnail direction',changes:[]}}});});
 await page.route('**/api/titles',r=>{calls++;expect(r.request().postDataJSON().provider).toBe('google');return r.fulfill({json:{titles:['One','Two','Three','Four','Five']}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 await openMoreOptions(page);const provider=page.getByLabel('Text and review provider',{exact:true});await expect(provider).toHaveValue('openai');expect(calls).toBe(0);
 await provider.selectOption('google');expect(calls).toBe(0);
 await page.reload();await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await expect(page.getByLabel('Text and review provider',{exact:true})).toHaveValue('google');
});

test('request activity recovers after reload by reading persisted outcomes without redispatch',async({page})=>{
 const f=await setup(page);await page.clock.install();let reads=0,writes=0,complete=false;
 const result={...f.creations[0],id:'66666666-6666-4666-8666-666666666666',title:'Recovered saved image'};
 await page.route('**/api/generate',r=>{writes++;return r.abort();});
 await page.route('**/api/jobs',r=>{reads++;expect(r.request().method()).toBe('GET');if(complete&&!f.creations.some(c=>c.id===result.id))f.creations.unshift(result);return r.fulfill({json:{jobs:[{id:'77777777-7777-4777-8777-777777777777',operation:'generate',state:complete?'succeeded':'running',max_provider_calls:1,result:complete?{creations:[result]}:null}]}});});
 await page.goto('/');await expect.poll(()=>reads).toBeGreaterThanOrEqual(1);await page.reload();await expect.poll(()=>reads).toBeGreaterThanOrEqual(2);
 complete=true;await page.clock.fastForward(5000);
 await page.getByRole('button',{name:'Connections',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'View API activity',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Completed');await expect(page.getByRole('button',{name:'Open saved result',exact:true})).toBeVisible();await page.getByRole('button',{name:'Open saved result',exact:true}).click();await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toContainText('Recovered saved image');expect(writes).toBe(0);
});
test('stopping activity refresh never claims to cancel provider work or resubmits it',async({page})=>{
 await setup(page);await page.clock.install();let reads=0;
 await page.route('**/api/jobs',r=>{reads++;expect(r.request().method()).toBe('GET');return r.fulfill({json:{jobs:[{id:'77777777-7777-4777-8777-777777777777',operation:'analyze',state:'running',max_provider_calls:1}]}});});
 await page.goto('/');await page.getByRole('button',{name:'Connections',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'View API activity',exact:true}).click();await page.getByRole('button',{name:'Stop waiting',exact:true}).click();const stopped=reads;await page.clock.fastForward(20000);expect(reads).toBe(stopped);await expect(page.getByRole('dialog')).toContainText('Provider work may still finish and use credits');await page.getByRole('button',{name:'Refresh activity',exact:true}).click();await expect.poll(()=>reads).toBeGreaterThan(stopped);
});

test('analysis history reads prior versions without changing a title or exposing a paid fix action',async({page})=>{
 await setup(page);let paid=0;
 await page.route('**/api/analyze',r=>{paid++;return r.abort();});
 await page.route('**/api/analyses?**',r=>r.fulfill({json:{analyses:[{id:'77777777-7777-4777-8777-777777777777',createdAt:'2026-11-09T10:00:00Z',verified:true,matchesCurrentImage:true,score:{source:'jev',version:3,title:'Assessed earlier title',overall:67,priority:'clarity',created_at:'2026-11-09T10:00:00Z',note:'History fixture',rubricVersion:'fixture-rubric',instructionVersion:'fixture-instructions',sourceDigest:'a'.repeat(64),vision:true,fixBlocked:false,contributors:[{provider:'Jev',model:'fixture',role:'scoring'}],dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:67,confidence:.7,observation:'Saved historical observation',strength:'Visible subject',weakness:'Competing text',fix:'Reduce competing text'}]))}}],nextCursor:null}}));
 await page.goto('/');await openResultMore(page);await page.getByRole('button',{name:'Score history',exact:true}).click();const dialog=page.getByRole('dialog');const version=dialog.locator('.history-version > summary').filter({hasText:'Assessed earlier title'});await expect(version).toBeVisible();await version.click();await expect(dialog).toContainText('fixture-rubric');await expect(dialog.getByRole('button',{name:"Fix what's holding it back",exact:true})).toHaveCount(0);expect(paid).toBe(0);for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:'evidence/advisory-history-'+width+'.png'});}await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.locator('.review-summary')).toContainText('Account A image');
});

test('native ratio warnings keep the full saved result and preserve the chosen source title',async({page})=>{
 const f=await setup(page),original=f.creations[0];original.score={source:'jev',version:3,title:'An older assessed title',context:{title:'An older assessed title'},overall:67,priority:'clarity',created_at:new Date().toISOString(),note:'Explicit fixture',dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:67,confidence:.7,observation:'Fixture',strength:'',weakness:'',fix:''}]))};let calls=0;
 await page.route('**/api/generate',r=>{calls++;const input=r.request().postDataJSON();expect(input.intent).toBe('recompose');expect(input.title).toBe('Account A image');const variant={...original,id:'66666666-6666-4666-8666-666666666666',score:null,mode:'edit',parent_id:original.id,settings:input.settings,lineage:{origin:'recomposed',nativeOutput:true,sourceId:original.id}};f.creations.unshift(variant);return r.fulfill({json:{creations:[variant],partial:false}});});
 await page.goto('/');await openResultMore(page);await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();await expect(page.locator('.native-output-note')).toContainText('800 × 450');await expect(page.locator('.native-output-note')).toContainText('Requested 9:16');await expect(page.locator('.native-output-note')).toContainText('Full returned image preserved');expect(calls).toBe(1);expect(f.creations.find(c=>c.id===original.id).title).toBe('Account A image');await settleResponsiveNavigation(page,320,900);await page.locator('.native-output-note').scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/advisory-native-output-320.png'});
});

test('authenticated provider checks stay neutral until the current account lookup finishes',async({page})=>{
 await setup(page);let release!:()=>void;const hold=new Promise<void>(r=>release=r);const preferences=page.waitForResponse(r=>r.url().includes('/rest/v1/studio_preferences'));
 await page.route('**/api/config',async r=>{const privateRead=!!r.request().headers().authorization;if(privateRead)await hold;return r.fulfill({json:{cloud:true,ai:true,openai:privateRead,google:false,jev:privateRead,ownerGate:false,supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test'}});});
 await page.goto('/');await preferences;await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 try{await expect(page.getByRole('button',{name:'Checking your workspace…',exact:true})).toBeDisabled();}finally{release();}
 await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await expect(page.getByRole('button',{name:'Create thumbnail',exact:true})).toBeEnabled();
});

test('Retry score reuses the first image requestId in a batch of 2',async({page})=>{
 const f=await setup(page);
 const failedId='99999999-9999-4999-8999-999999999991',okId='99999999-9999-4999-8999-999999999992';
 const ids=new Map<string,string[]>();
 const score={source:'jev',version:3,title:'A factual title',overall:60,priority:'clarity',created_at:new Date().toISOString(),note:'Fixture',vision:true,fixBlocked:true,
  contributors:[{provider:'Jev',model:'fixture',role:'scoring'},{provider:'OpenAI API',model:'fixture',role:'image-review'}],
  dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:60,confidence:.7,observation:'Fixture',strength:'',weakness:'',fix:''}]))};
 await page.route('**/api/generate',r=>{
  const items=[{...f.creations[0],id:failedId,score:null},{...f.creations[0],id:okId,score:null}];
  for(const item of items)f.creations.unshift(item);
  return r.fulfill({json:{creations:items,partial:false}});
 });
 await page.route('**/api/analyze',r=>{
  const input=r.request().postDataJSON();
  const list=ids.get(input.creationId)||[];list.push(input.requestId);ids.set(input.creationId,list);
  if(input.creationId===failedId)return r.fulfill({status:502,json:{error:'Fixture scoring unavailable'}});
  const item=f.creations.find(c=>c.id===input.creationId);if(item)item.score=score;
  return r.fulfill({json:{score,creationId:input.creationId}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 await page.getByLabel('Images per request',{exact:true}).selectOption('2');
 await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();
 await expect.poll(()=>[...(ids.values())].reduce((n,list)=>n+list.length,0)).toBe(2);
 await expect(page.getByRole('region',{name:'Thumbnail delivery'})).toHaveAttribute('data-stage','review-pending');
 await expect(page.getByLabel('Scoring inspector')).toContainText('Score did not finish');
 await page.getByRole('button',{name:'Retry score',exact:true}).click();
 await expect.poll(()=>(ids.get(failedId)||[]).length).toBe(2);
 expect(ids.get(failedId)![0]).toBe(ids.get(failedId)![1]);
 expect((ids.get(okId)||[]).length).toBe(1);
});
