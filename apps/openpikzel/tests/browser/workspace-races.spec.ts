import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',chatA='33333333-3333-4333-8333-333333333333',chatB='44444444-4444-4444-8444-444444444444';
function session(id:string){return {access_token:'header.'+Buffer.from(JSON.stringify({sub:id,exp:4102444800})).toString('base64url')+'.signature',refresh_token:'fixture-only-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:id===A?'a@example.test':'b@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-11-08T00:00:00Z'}};}
async function setup(page:Page){
 await page.route('**/*',r=>(new URL(r.request().url()).hostname==='127.0.0.1'||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 const settings={model:'flare',quality:'low',complexity:'low',format:'long',batch:1},now=new Date().toISOString(),chats:any[]=[{id:chatA,user_id:A,title:'Account A chat',draft:{prompt:'A factual thumbnail from account A',settings},created_at:now,updated_at:now},{id:chatB,user_id:B,title:'Account B chat',draft:{prompt:'A separate private account B draft',settings},created_at:now,updated_at:now}],creations:any[]=[{id:'55555555-5555-4555-8555-555555555555',user_id:A,conversation_id:chatA,title:'Account A image',prompt:'A factual thumbnail from account A',mode:'generate',style:'Auto',persona_id:null,parent_id:null,image_path:A+'/image.png',status:'ready',favorite:false,settings,created_at:now}];
 chats.push({id:'88888888-8888-4888-8888-888888888888',user_id:A,title:'Account A other chat',draft:{prompt:'Another A project'},created_at:now,updated_at:now});
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
 return {settings,chats,creations};
}
test('busy generation cannot switch chats through library navigation',async({page})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/generate',async route=>{entered();await hold;const result={...f.creations[0],id:'66666666-6666-4666-8666-666666666666',title:'Completed in account A',created_at:new Date().toISOString()};f.creations.unshift(result);await route.fulfill({json:{creations:[result],partial:false}});});
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('button',{name:'Generate',exact:true}).click();await waiting;
 await expect(page.getByRole('button',{name:'My creations',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Open chat: Account A other chat',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'My creations',exact:true}).evaluate((e:HTMLButtonElement)=>e.click());await expect(page.locator('.chat-title')).toContainText('Account A chat');release();await expect(page.getByRole('heading',{name:'Your thumbnail.',exact:true})).toBeVisible();await expect(page.locator('.review-summary')).toContainText('Completed in account A');
 expect(f.chats.find(c=>c.id===chatB).draft.prompt).toBe('A separate private account B draft');
});
test('delayed account A resize cannot overwrite account B hydration or draft',async({page,context})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/resize',async route=>{entered();await hold;await route.fulfill({json:{creation:{...f.creations[0],id:'77777777-7777-4777-8777-777777777777',mode:'resize',parent_id:f.creations[0].id,settings:{...f.settings,format:'short'}}}});});
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'Resize to short-form',exact:true}).click();await waiting;
 await page.evaluate(s=>{localStorage.setItem('sb-test-auth-token',JSON.stringify(s));const bc=new BroadcastChannel('sb-test-auth-token');bc.postMessage({event:'SIGNED_IN',session:s});setTimeout(()=>bc.close(),100);},session(B));
 await expect(page.locator('.chat-title')).toContainText('Account B chat');release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await expect(page.getByRole('alert').filter({hasText:'Your account changed'})).toHaveCount(0);await expect(page.locator('.chat-title')).toContainText('Account B chat');await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue('A separate private account B draft');
 expect(f.chats.find(c=>c.id===chatB).draft.prompt).toBe('A separate private account B draft');
});

test('explicit save cannot overwrite newer edits already checkpointed during a slow creation write',async({page})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('https://test.supabase.co/rest/v1/studio_creations*',async route=>{if(route.request().method()!=='POST')return route.fallback();entered();await hold;f.creations.push(route.request().postDataJSON());await route.fulfill({status:201,body:'',headers:{'access-control-allow-origin':'*'}});});
 await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByLabel('Prompt',{exact:true}).fill('The first submitted image concept');await page.getByRole('button',{name:'Save draft',exact:true}).click();await waiting;
 await page.getByLabel('Prompt',{exact:true}).fill('The newer edited concept must survive');await expect.poll(()=>f.chats.find(c=>c.id===chatA).draft.prompt).toBe('The newer edited concept must survive');release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await page.reload();await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue('The newer edited concept must survive');
});

test('editing uses the newly selected library source and preserves the unsent brief',async({page})=>{
 const f=await setup(page),newSource={...f.creations[0],id:"99999999-9999-4999-8999-999999999999",title:"New selected source",image_path:A+"/replacement.png"};f.creations.push(newSource);
 let submitted:any=null;await page.route("**/api/generate",async route=>{submitted=route.request().postDataJSON();await route.fulfill({status:409,json:{error:"Fixture stopped before provider dispatch"}});});
 await page.goto("/");await page.getByRole("region",{name:"Thumbnail review studio"}).getByRole("button",{name:"Edit",exact:true}).click();
 await page.getByLabel("Edits",{exact:true}).fill("Preserve this direction when I change the source");
 await page.getByRole("button",{name:"Choose references from library",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"New selected source"}).click();
 await expect(page.getByRole("img",{name:"Editing source: New selected source",exact:true})).toBeVisible();await expect(page.getByLabel("Edits",{exact:true})).toHaveValue("Preserve this direction when I change the source");
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});const preview=page.getByRole("img",{name:"Editing source: New selected source",exact:true});await page.getByLabel("Edits",{exact:true}).scrollIntoViewIfNeeded();await expect(preview).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);if(width===1440){const a=await preview.boundingBox(),b=await page.getByLabel("Edits",{exact:true}).boundingBox();expect(a!.x+a!.width).toBeLessThan(b!.x);}else{await page.locator(".edit-source-preview summary").click();await expect(preview).toBeHidden();await page.locator(".edit-source-preview summary").click();await expect(preview).toBeVisible();}await page.screenshot({path:"evidence/audit-cloud-edit-"+width+".png"});}
 await page.getByRole("button",{name:"Generate",exact:true}).click();await expect.poll(()=>submitted?.parentId).toBe(newSource.id);expect(submitted.prompt).toBe("Preserve this direction when I change the source");expect(submitted.settings.model).toBe("flare");
});

test('typing while generation runs preserves new direction and offers a result without stealing focus',async({page})=>{
 const f=await setup(page);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('**/api/generate',async route=>{entered();await hold;const result={...f.creations[0],id:'66666666-6666-4666-8666-666666666666',title:'Completed result',created_at:new Date().toISOString()};f.creations.unshift(result);await route.fulfill({json:{creations:[result],partial:false}});});
 await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await page.getByRole('button',{name:'Generate',exact:true}).click();await waiting;
 const prompt=page.getByLabel('Prompt',{exact:true});await prompt.fill('My next idea must stay open while this result finishes');release();
 await expect(page.getByRole('button',{name:'View result',exact:true})).toBeVisible();await expect(prompt).toHaveValue('My next idea must stay open while this result finishes');await expect(prompt).toBeFocused();
 await page.reload();await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await expect(prompt).toHaveValue('My next idea must stay open while this result finishes');
});
test('request activity is reachable inside its modal and refresh never resubmits a request',async({page})=>{
 const f=await setup(page);let reads=0,paid=0;
 await page.route('**/api/jobs',r=>{reads++;return r.fulfill({json:{jobs:[{id:'fixture-request',operation:'generate',state:reads===1?'reconciling':'succeeded',max_provider_calls:1,created_at:'2026-11-09T12:00:00Z',result:reads>1?{creation:{id:f.creations[0].id}}:null}]}});});
 await page.route('**/api/generate',r=>{paid++;return r.abort();});await page.goto('/');await expect(page.locator('.chat-title')).toContainText('Account A chat');
 await page.getByRole('button',{name:'Connections',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'View API activity',exact:true}).click();await expect(dialog).toContainText('Outcome uncertain');
 await dialog.getByRole('button',{name:'Refresh activity',exact:true}).focus();await page.keyboard.press('Enter');await expect(dialog).toContainText('Completed');
 await dialog.getByRole('button',{name:'Open saved result',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('.review-summary')).toContainText('Account A image');expect(reads).toBe(2);expect(paid).toBe(0);
});
test('slow first autosave cannot steal a subsequently selected chat',async({page})=>{
 const f=await setup(page);await page.addInitScript(({A})=>localStorage.removeItem('openpikzels.activeChat.'+A),{A});
 let release!:()=>void,entered!:()=>void,held=false;const waiting=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 await page.route('https://test.supabase.co/rest/v1/studio_conversations*',async r=>{if(r.request().method()==='POST'&&!held){held=true;entered();await hold;}await r.fallback();});
 await page.goto('/');await expect(page.getByRole('button',{name:'Open chat: Account A other chat',exact:true})).toBeVisible();await page.getByLabel('Prompt',{exact:true}).fill('Detached first draft must still be saved');await waiting;
 await page.getByLabel('Prompt',{exact:true}).fill('Latest detached revision must still be saved');
 const navigation=page.getByRole('button',{name:'Open chat: Account A other chat',exact:true}).click();release();await navigation;await expect(page.locator('.chat-title')).toContainText('Account A other chat');
 await expect.poll(()=>f.chats.some(c=>c.draft.prompt==='Latest detached revision must still be saved')).toBe(true);
 await expect(page.locator('.chat-title')).toContainText('Account A other chat');await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue('Another A project');
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
 await setup(page);await page.goto('/');await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();const prompt=page.getByLabel('Prompt',{exact:true});await prompt.fill('Preserve this brief before the chat changes');
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
 await page.goto('/');await page.getByRole('region',{name:'Thumbnail review studio'}).getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Edits',{exact:true}).fill('Keep my newest image as the editing source');await page.getByRole('button',{name:'Save draft',exact:true}).click();await waiting;
 await page.getByRole('button',{name:'Choose references from library',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'New selected source'}).click();release();
 await expect(page.locator('.operation-progress')).toHaveCount(0);await expect(page.getByRole('img',{name:'Editing source: New selected source',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Show prompt and settings',exact:true}).click();await expect(page.getByRole('img',{name:'Editing source: New selected source',exact:true})).toBeVisible();
});
