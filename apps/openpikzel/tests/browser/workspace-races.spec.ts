import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',chatA='33333333-3333-4333-8333-333333333333',chatB='44444444-4444-4444-8444-444444444444';
function session(id:string){return {access_token:'header.'+Buffer.from(JSON.stringify({sub:id,exp:4102444800})).toString('base64url')+'.signature',refresh_token:'fixture-only-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:id===A?'a@example.test':'b@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-11-08T00:00:00Z'}};}
async function setup(page:Page){
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
 await expect(page.locator('.operation-progress')).toHaveCount(0);await expect(page.locator('.chat-title')).toContainText('Account B chat');await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue('A separate private account B draft');
 expect(f.chats.find(c=>c.id===chatB).draft.prompt).toBe('A separate private account B draft');
});
