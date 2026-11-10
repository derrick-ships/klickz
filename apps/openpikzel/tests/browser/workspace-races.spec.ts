import {test,expect,type Page} from '@playwright/test';
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
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();await waiting;
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

test('editing uses the newly selected library source and preserves the unsent brief',async({page})=>{
 const f=await setup(page),newSource={...f.creations[0],id:"99999999-9999-4999-8999-999999999999",title:"New selected source",image_path:A+"/replacement.png"};f.creations.push(newSource);
 let submitted:any=null;await page.route("**/api/generate",async route=>{submitted=route.request().postDataJSON();await route.fulfill({status:409,json:{error:"Fixture stopped before provider dispatch"}});});
 await page.goto("/");await page.getByRole("region",{name:"Thumbnail review studio"}).getByRole("button",{name:"Edit",exact:true}).click();
 await page.getByLabel("What should change?",{exact:true}).fill("Preserve this direction when I change the source");
 await page.getByRole("button",{name:"Choose references from library",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"New selected source"}).click();
 await expect(page.getByRole("img",{name:"Editing source: New selected source",exact:true})).toBeVisible();await expect(page.getByLabel("What should change?",{exact:true})).toHaveValue("Preserve this direction when I change the source");
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});const preview=page.getByRole("img",{name:"Editing source: New selected source",exact:true});await page.getByLabel("What should change?",{exact:true}).scrollIntoViewIfNeeded();await expect(preview).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);if(width===1440){const a=await preview.boundingBox(),b=await page.getByLabel("What should change?",{exact:true}).boundingBox();expect(a!.x+a!.width).toBeLessThan(b!.x);}else{await page.locator(".edit-source-preview summary").click();await expect(preview).toBeHidden();await page.locator(".edit-source-preview summary").click();await expect(preview).toBeVisible();}await page.screenshot({path:"evidence/audit-cloud-edit-"+width+".png"});}
 await page.getByRole("button",{name:"Apply AI edit",exact:true}).click();await expect.poll(()=>submitted?.parentId).toBe(newSource.id);expect(submitted.prompt).toBe("Preserve this direction when I change the source");expect(submitted.settings.model).toBe("flare");
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
for(const returnToA of [false,true])test('stale title response cannot enter '+(returnToA?'a new session of account A':'account B'),async({page})=>{
 await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/titles',async r=>{entered();await hold;await r.fulfill({json:{titles:['PRIVATE STALE TITLE']}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('tab',{name:'Title',exact:true}).click();await page.getByRole('button',{name:'Title ideas',exact:true}).click();await page.getByRole('button',{name:'Generate titles',exact:true}).click();await waiting;
 await switchAccount(page,B);if(returnToA)await switchAccount(page,A);release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await expect(page.getByText('PRIVATE STALE TITLE',{exact:true})).toHaveCount(0);
});
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
 await expect(prompt).toBeDisabled();await expect(page.getByRole('tab',{name:'Edit',exact:true})).toBeDisabled();release();
 await expect(page.locator('.chat-title')).toContainText('Account A other chat');await expect(prompt).toBeEnabled();await expect(prompt).toHaveValue('Another A project');
});
test('explicit save does not reselect an old editing source after a new source is chosen',async({page})=>{
 const f=await setup(page),source={...f.creations[0],id:'99999999-9999-4999-8999-999999999999',title:'New selected source',image_path:A+'/replacement.png'};f.creations.push(source);
 let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('https://test.supabase.co/rest/v1/studio_creations*',async r=>{if(r.request().method()!=='POST')return r.fallback();entered();await hold;f.creations.push(r.request().postDataJSON());await r.fulfill({status:201,body:'',headers:{'access-control-allow-origin':'*'}});});
 await page.goto('/');await page.getByRole('region',{name:'Thumbnail review studio'}).getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel("What should change?",{exact:true}).fill('Keep my newest image as the editing source');await page.getByRole('button',{name:'Save draft',exact:true}).click();await waiting;
 await page.getByRole('button',{name:'Choose references from library',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'New selected source'}).click();release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await expect(page.getByRole('img',{name:'Editing source: New selected source',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await expect(page.getByRole('img',{name:'Editing source: New selected source',exact:true})).toBeVisible();
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
 await page.getByRole('tab',{name:'Recreate',exact:true}).click();await expect(page.getByRole('button',{name:'Create variation',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Edit',exact:true}).click();await expect(page.getByRole('button',{name:'Apply AI edit',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Title',exact:true}).click();await expect(page.getByRole('button',{name:'Create thumbnail',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Title ideas',exact:true}).click();await expect(page.getByRole('button',{name:'Generate titles',exact:true})).toBeVisible();
 await page.route('**/api/analyze',r=>r.fulfill({status:502,json:{error:'Fixture scoring unavailable'}}));
 await page.getByRole('tab',{name:'Prompt',exact:true}).click();await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your thumbnail.',exact:true})).toBeVisible();
 expect(generated.title).toBe('');
 await expect(page.getByRole('button',{name:'Retry score',exact:true})).toBeVisible();
});

test('blank title mode stops before dispatch and preserves entered title after recovery',async({page})=>{
 await setup(page);let paid=0;
 await page.route('**/api/generate',async r=>{paid++;await r.fulfill({status:409,json:{error:'Fixture stops before provider dispatch'}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByLabel('Describe your thumbnail',{exact:true}).fill('');
 await page.getByRole('tab',{name:'Title',exact:true}).click();await page.getByLabel('Video title',{exact:true}).fill('');
 await expect(page.locator('#request-readiness')).toContainText('Add a video title or direction before generating.');
 await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Add a video title or direction before generating.'})).toBeVisible();expect(paid).toBe(0);
 await page.getByLabel('Video title',{exact:true}).fill('Seven days rebuilding my studio');await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();
 await expect.poll(()=>paid).toBe(1);await expect(page.getByLabel('Video title',{exact:true})).toHaveValue('Seven days rebuilding my studio');
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
 await page.goto('/connect');await expect(page.getByText('Checking connections…',{exact:true})).toHaveCount(4);await expect(page.getByText('Loading connected agents…',{exact:true})).toBeVisible();
 await expect(page.getByText('Not connected',{exact:true})).toHaveCount(0);release();
 await expect(page.getByText('Connection status unavailable. Refresh to check.',{exact:true})).toBeVisible();await expect(page.getByText('No agents connected yet.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Refresh connections',exact:true}).click();await expect(page.getByText('Not connected',{exact:true})).toHaveCount(4);await expect(page.getByText('No agents connected yet.',{exact:true})).toBeVisible();expect(writes).toBe(0);
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
 await page.goto('/');await page.getByRole('button',{name:'Analyze',exact:true}).click();
 await page.getByLabel('Video title',{exact:true}).fill('A factual studio rebuild');
 await page.getByLabel('YouTube video link (optional)',{exact:true}).fill('https://youtu.be/abcdefghijk');await page.getByLabel('Add image-specific review to analysis (one extra provider request)',{exact:true}).check();
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
 await page.goto('/');await page.getByRole('button',{name:'Analyze',exact:true}).click();await page.getByLabel('Video title',{exact:true}).fill('Actual video title');
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 const scanner=page.getByRole('region',{name:'Thumbnail analysis activity'});
 await expect(scanner).toHaveAttribute('data-phase','failed');await expect(scanner).toContainText('check saved results before retrying');
 expect(Number((await scanner.locator('.scanner-counter').innerText()).split('/')[0])).toBeLessThan(100);
 await page.getByRole('button',{name:'Analyze thumbnail',exact:true}).click();
 await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);await expect(scanner).toHaveAttribute('data-phase','failed');
});

test('AI resize dispatches one source-based recomposition and retains the original and draft',async({page})=>{
 const f=await setup(page),original={...f.creations[0]};let calls=0,submitted:any;
 await page.route('**/api/generate',async r=>{
  calls++;const input=r.request().postDataJSON();submitted=input;expect(input.mode).toBe("edit");expect(input.parentId).toBe(original.id);expect(input.referencePaths).toEqual([original.image_path]);
  expect(input.settings.format).toBe("short");expect(input.settings.batch).toBe(1);expect(input.prompt).toContain("vertical 9:16");expect(input.prompt).toContain("Do not merely crop");
  const copy={...original,id:"77777777-7777-4777-8777-777777777777",mode:"edit",parent_id:original.id,settings:input.settings,prompt:input.prompt};f.creations.unshift(copy);
  await r.fulfill({json:{creations:[copy],partial:false}});
 });
 await page.goto('/');await expect(page.locator('.resize-note')).toContainText('Provider usage charges apply');
 await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
 await expect(page.getByRole('button',{name:'AI resize to long-form',exact:true})).toBeVisible();expect(calls).toBe(1);expect(submitted.title).toBe(original.title);
 expect(f.creations.find(c=>c.id===original.id)).toEqual(original);
 expect(f.chats.find(c=>c.id===chatA).draft.prompt).toBe('A factual thumbnail from account A');
});

test('failed AI resize preserves the source and never falls back to a padded image',async({page})=>{
 const f=await setup(page);let fallback=0;const ids:string[]=[];
 await page.route('**/api/resize',r=>{fallback++;return r.abort();});
 await page.route('**/api/generate',r=>{ids.push(r.request().postDataJSON().requestId);return r.fulfill({status:502,json:{error:"Fixture generation unavailable"}});});
 await page.goto('/');await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Fixture generation unavailable'})).toBeVisible();
 await expect(page.getByRole('button',{name:'AI resize to short-form',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
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
 await page.goto('/');await page.getByRole('button',{name:'Analyze',exact:true}).click();await page.getByLabel('Video title',{exact:true}).fill('A factual title');
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
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();
 await expect(page.getByRole('region',{name:'Thumbnail delivery'})).toHaveAttribute('data-stage','review-pending');
 expect(f.creations).toHaveLength(2);expect(images).toBe(1);expect(scores).toBe(1);await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();
 await expect(page.getByLabel('Scoring inspector')).toContainText('Score did not finish');
 await page.getByRole('button',{name:'Retry score',exact:true}).click();
 await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);
});

test('prompt enhancement is reviewed, reversible, and never generates an image',async({page})=>{
 await setup(page);let images=0;await page.route('**/api/generate',r=>{images++;return r.abort();});
 await page.route('**/api/creative',r=>{expect(r.request().postDataJSON().task).toBe('enhance');return r.fulfill({json:{model:'gpt-5.4-nano',value:{prompt:'A factual studio portrait, one clear subject and a readable headline.',changes:['Clarified composition']}}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();
 const composer=page.getByLabel('Describe your thumbnail',{exact:true}),before=await composer.inputValue();
 await page.getByRole('button',{name:'Enhance prompt',exact:true}).click();await expect(page.getByRole('region',{name:'Prompt enhancement'})).toBeVisible();await expect(composer).toHaveValue(before);
 await page.getByRole('button',{name:'Apply enhancement',exact:true}).click();await expect(composer).toHaveValue('A factual studio portrait, one clear subject and a readable headline.');
 await page.getByRole('button',{name:'Undo direction change',exact:true}).click();await expect(composer).toHaveValue(before);expect(images).toBe(0);
});

test('late prompt enhancement cannot replace newer user text and failed retries keep request ID',async({page})=>{
 await setup(page);let release!:()=>void;const hold=new Promise<void>(r=>release=r);const ids:string[]=[];
 await page.route('**/api/creative',async r=>{ids.push(r.request().postDataJSON().requestId);if(ids.length===1)return r.fulfill({status:502,json:{error:'Fixture temporary text failure'}});await hold;return r.fulfill({json:{model:'fixture',value:{prompt:'A proposed clear portrait with warm light.',changes:[]}}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('button',{name:'Enhance prompt',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Fixture temporary text failure'})).toBeVisible();
 await page.getByRole('button',{name:'Enhance prompt',exact:true}).click();await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);
 const input=page.getByLabel('Describe your thumbnail',{exact:true});await input.fill('A newer unsent direction must survive this response');release();await expect(page.getByRole('button',{name:'Apply enhancement',exact:true})).toBeDisabled();await expect(input).toHaveValue('A newer unsent direction must survive this response');
});

test('creative chat chooses a separate Google model and prepares image actions without executing them',async({page})=>{
 const f=await setup(page);let imageCalls=0;
 await page.route('**/api/config',r=>r.fulfill({json:{cloud:true,ai:true,openai:true,google:true,jev:true,supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test',promptModel:'gpt-5.4-nano',textModels:{openai:'configured-openai',google:'configured-google'}}}));
 await page.route('**/api/generate',r=>{imageCalls++;return r.abort();});
 await page.route('**/api/creative',r=>{const input=r.request().postDataJSON();expect(input.provider).toBe('google');expect(input.conversationId).toBe(chatA);expect(input.creationId).toBe(f.creations[0].id);expect(input.task).toBe('chat');expect(input.direction).toBe('A factual thumbnail from account A');return r.fulfill({json:{model:'configured-google',value:{reply:'Try a single face and one clear visual contrast.',proposal:{kind:'edit',prompt:'Brighten the selected face; keep the exact headline and background.',title:''}}}});});
 await page.goto('/');await page.locator('.creative-conversation summary').click();await page.getByLabel('Conversation model',{exact:true}).selectOption('google:economy');await page.getByLabel('Message your creative partner').fill('How could we simplify this thumbnail?');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('log',{name:'Creative conversation'})).toContainText('Try a single face');expect(imageCalls).toBe(0);
 await page.getByRole('button',{name:'Review in composer',exact:true}).click();await expect(page.getByLabel('What should change?',{exact:true})).toHaveValue('Brighten the selected face; keep the exact headline and background.');
 await expect(page.getByLabel('Rendering model')).toContainText('Flare');expect(imageCalls).toBe(0);
 await expect.poll(()=>f.chats.find(c=>c.id===chatA).draft.creativeDraft?.messages?.length).toBe(2);
 for(const width of [1440,390,320]){await settleResponsiveNavigation(page,width,1000);await page.locator('.creative-conversation').scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/creative-chat-'+width+'.png'});}
 await page.reload();await page.locator('.creative-conversation summary').click();await expect(page.getByRole('log',{name:'Creative conversation'})).toContainText('Try a single face');await expect(page.getByLabel('Conversation model')).toHaveValue('google:economy');
});

test('a late creative reply cannot enter another project',async({page})=>{
 const f=await setup(page);let release!:()=>void;const hold=new Promise<void>(r=>release=r);
 await page.route('**/api/creative',async r=>{await hold;return r.fulfill({json:{model:'fixture',value:{reply:'Private reply for the original project only.',proposal:null}}});});
 await page.goto('/');await page.locator('.creative-conversation summary').click();await page.getByLabel('Message your creative partner').fill('Discuss this original project thumbnail');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByRole('button',{name:'Thinking…',exact:true})).toBeVisible();
 await page.locator('aside.sidebar').getByRole('button',{name:'Open chat: Account A other chat',exact:true}).click();release();
 await page.locator('.creative-conversation summary').click();await expect(page.getByRole('log',{name:'Creative conversation'})).not.toContainText('Private reply');
 expect(f.chats.find(c=>c.title==='Account A other chat').draft.creativeDraft?.messages||[]).toHaveLength(0);
});

for(const width of [320,390])test('mobile studio navigation leaves creative chat usable at '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:900});await setup(page);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/creative',r=>r.fulfill({json:{model:'fixture',value:{reply:'Use one clear focal point.',proposal:null}}}));
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');
 await expect(page.locator('aside.sidebar')).toBeHidden();
 await page.getByRole('button',{name:'Open sidebar',exact:true}).click();await expect(page.locator('aside.sidebar')).toBeVisible();
 await expect(page.locator('.workspace-main')).toHaveAttribute('inert','');await expect(page.locator('.workspace-main')).toHaveCSS('filter','blur(6px)');
 await page.getByRole('button',{name:'Close sidebar',exact:true}).click();await settleResponsiveNavigation(page,width,900);
 await page.locator('.creative-conversation summary').click();
 await page.getByLabel('Message your creative partner').fill('Simplify the selected thumbnail');
 await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByRole('log',{name:'Creative conversation'})).toContainText('Use one clear focal point.');
 await expect(page.getByRole('button',{name:'Send message',exact:true})).toBeVisible();expect(errors).toEqual([]);
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
 const provider=page.getByLabel('Text and review provider',{exact:true});await expect(provider).toHaveValue('openai');await expect(page.getByRole('button',{name:'Enhance prompt',exact:true})).toBeDisabled();expect(calls).toBe(0);
 await provider.selectOption('google');await page.getByRole('button',{name:'Enhance prompt',exact:true}).click();await expect(page.getByRole('region',{name:'Prompt enhancement'})).toBeVisible();
 await page.getByRole('tab',{name:'Title',exact:true}).click();await page.getByRole('button',{name:'Title ideas',exact:true}).click();await page.getByRole('button',{name:'Generate titles',exact:true}).click();await expect.poll(()=>calls).toBe(2);
 await page.reload();await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await expect(page.getByLabel('Text and review provider',{exact:true})).toHaveValue('google');
});

test('request activity recovers after reload by reading persisted outcomes without redispatch',async({page})=>{
 const f=await setup(page);await page.clock.install();let reads=0,writes=0,complete=false;
 const result={...f.creations[0],id:'66666666-6666-4666-8666-666666666666',title:'Recovered saved image'};
 await page.route('**/api/generate',r=>{writes++;return r.abort();});
 await page.route('**/api/jobs',r=>{reads++;expect(r.request().method()).toBe('GET');if(complete&&!f.creations.some(c=>c.id===result.id))f.creations.unshift(result);return r.fulfill({json:{jobs:[{id:'77777777-7777-4777-8777-777777777777',operation:'generate',state:complete?'succeeded':'running',max_provider_calls:1,result:complete?{creations:[result]}:null}]}});});
 await page.goto('/');await expect(page.getByRole('status').filter({hasText:'1 active API request'})).toBeVisible();await page.reload();await expect.poll(()=>reads).toBeGreaterThanOrEqual(2);
 complete=true;await page.clock.fastForward(5000);await expect(page.getByRole('status').filter({hasText:'1 active API request'})).toHaveCount(0);
 await page.getByRole('button',{name:'API activity',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Completed');await expect(page.getByRole('button',{name:'Open saved result',exact:true})).toBeVisible();await page.getByRole('button',{name:'Open saved result',exact:true}).click();await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toContainText('Recovered saved image');expect(writes).toBe(0);
});
test('stopping activity refresh never claims to cancel provider work or resubmits it',async({page})=>{
 await setup(page);await page.clock.install();let reads=0;
 await page.route('**/api/jobs',r=>{reads++;expect(r.request().method()).toBe('GET');return r.fulfill({json:{jobs:[{id:'77777777-7777-4777-8777-777777777777',operation:'analyze',state:'running',max_provider_calls:1}]}});});
 await page.goto('/');await expect(page.getByRole('status').filter({hasText:'1 active API request'})).toBeVisible();await page.getByRole('button',{name:'API activity',exact:true}).click();await page.getByRole('button',{name:'Stop waiting',exact:true}).click();const stopped=reads;await page.clock.fastForward(20000);expect(reads).toBe(stopped);await expect(page.getByRole('dialog')).toContainText('Provider work may still finish and use credits');await page.getByRole('button',{name:'Refresh activity',exact:true}).click();await expect.poll(()=>reads).toBeGreaterThan(stopped);
});

test('analysis history reads prior versions without changing a title or exposing a paid fix action',async({page})=>{
 await setup(page);let paid=0;
 await page.route('**/api/analyze',r=>{paid++;return r.abort();});
 await page.route('**/api/analyses?**',r=>r.fulfill({json:{analyses:[{id:'77777777-7777-4777-8777-777777777777',createdAt:'2026-11-09T10:00:00Z',verified:true,matchesCurrentImage:true,score:{source:'jev',version:3,title:'Assessed earlier title',overall:67,priority:'clarity',created_at:'2026-11-09T10:00:00Z',note:'History fixture',rubricVersion:'fixture-rubric',instructionVersion:'fixture-instructions',sourceDigest:'a'.repeat(64),vision:true,fixBlocked:false,contributors:[{provider:'Jev',model:'fixture',role:'scoring'}],dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:67,confidence:.7,observation:'Saved historical observation',strength:'Visible subject',weakness:'Competing text',fix:'Reduce competing text'}]))}}],nextCursor:null}}));
 await page.goto('/');await page.getByRole('button',{name:'Analysis history',exact:true}).click();const dialog=page.getByRole('dialog');const version=dialog.locator('.history-version > summary').filter({hasText:'Assessed earlier title'});await expect(version).toBeVisible();await version.click();await expect(dialog).toContainText('fixture-rubric');await expect(dialog.getByRole('button',{name:'One-click fix',exact:true})).toHaveCount(0);expect(paid).toBe(0);for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:'evidence/advisory-history-'+width+'.png'});}await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.locator('.review-summary')).toContainText('Account A image');
});

test('native ratio warnings keep the full saved result and preserve the chosen source title',async({page})=>{
 const f=await setup(page),original=f.creations[0];original.score={source:'jev',version:3,title:'An older assessed title',context:{title:'An older assessed title'},overall:67,priority:'clarity',created_at:new Date().toISOString(),note:'Explicit fixture',dimensions:Object.fromEntries(['virality','clarity','idea','curiosity','emotion'].map(p=>[p,{score:67,confidence:.7,observation:'Fixture',strength:'',weakness:'',fix:''}]))};let calls=0;
 await page.route('**/api/generate',r=>{calls++;const input=r.request().postDataJSON();expect(input.intent).toBe('recompose');expect(input.title).toBe('Account A image');const variant={...original,id:'66666666-6666-4666-8666-666666666666',score:null,mode:'edit',parent_id:original.id,settings:input.settings,lineage:{origin:'recomposed',nativeOutput:true,sourceId:original.id}};f.creations.unshift(variant);return r.fulfill({json:{creations:[variant],partial:false}});});
 await page.goto('/');await page.getByRole('button',{name:'AI resize to short-form',exact:true}).click();await expect(page.locator('.native-output-note')).toContainText('800 × 450');await expect(page.locator('.native-output-note')).toContainText('Requested 9:16');await expect(page.locator('.native-output-note')).toContainText('Full returned image preserved');expect(calls).toBe(1);expect(f.creations.find(c=>c.id===original.id).title).toBe('Account A image');await settleResponsiveNavigation(page,320,900);await page.locator('.native-output-note').scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/advisory-native-output-320.png'});
});
test('chat reference images require opt-in and late proposals cannot replace a newer direction',async({page})=>{
 await setup(page);let release!:()=>void;const hold=new Promise<void>(r=>release=r);let calls=0;
 await page.route('**/api/creative',async r=>{calls++;const input=r.request().postDataJSON();expect(input.includeReferences).toBe(true);expect(input.referencePaths).toContain(A+'/image.png');await hold;return r.fulfill({json:{model:'fixture',value:{reply:'A reply for the earlier direction',proposal:{kind:'edit',prompt:'An earlier edit direction',title:''}}}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('button',{name:'Choose references from library',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Account A image',exact:true}).click();
 await page.locator('.creative-conversation summary').click();const optIn=page.getByRole("checkbox",{name:/Include the first two selected reference/});await expect(optIn).not.toBeChecked();await optIn.check();await page.getByLabel('Message your creative partner').fill('How should this selected image change?');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect.poll(()=>calls).toBe(1);const prompt=page.getByLabel('Describe your thumbnail',{exact:true});await prompt.fill('A newer unsent direction must be preserved');release();await expect(page.getByRole('log',{name:'Creative conversation'})).toContainText('A reply for the earlier direction');await expect(page.getByRole('button',{name:'Review in composer',exact:true})).toBeDisabled();await expect(prompt).toHaveValue('A newer unsent direction must be preserved');
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
