import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
type Row={id:string;name:string;notes:string;refs:string[];created_at:string;profile_status:string;user_id?:string};

async function seedLocal(page:Page,personas:Row[],styles:Row[]=[]){
 const png=await sharp({create:{width:20,height:20,channels:3,background:'#ac524e'}}).png().toBuffer();
 await page.goto('/connect');
 await page.evaluate(async({bytes,personas,styles})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const r=indexedDB.open('derrick-thumbnail-studio',2);
   r.onupgradeneeded=()=>{for(const s of ['creations','personas','styles','assets','conversations','preferences','feedback'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'});};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const tx=db.transaction(['personas','styles','assets'],'readwrite');
  const buf=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)).buffer;
  for(const id of ['ref-0','ref-1','ref-2'])tx.objectStore('assets').put({id,bytes:buf,mime:'image/png'});
  for(const p of personas)tx.objectStore('personas').put(p);
  for(const s of styles)tx.objectStore('styles').put(s);
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  db.close();
 },{bytes:png.toString('base64'),personas,styles});
}
async function readLocal(page:Page,store:'personas'|'styles'){
 return page.evaluate(async store=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('derrick-thumbnail-studio');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const rows=await new Promise<any[]>((resolve,reject)=>{const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  db.close();return rows.sort((a,b)=>a.id.localeCompare(b.id));
 },store);
}
const local=(id:string,name:string,profile_status='draft'):Row=>({id,name,notes:'',refs:['ref-0','ref-1','ref-2'],created_at:'2026-11-10T00:00:00.000Z',profile_status});
const row=(page:Page,name:string)=>page.locator('.profile-item',{has:page.locator('strong',{hasText:new RegExp('^'+name+'$')})});
const noOverflow=async(page:Page)=>expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

test('renaming a local persona keeps unique names and shows a clear clash error',async({page})=>{
 await seedLocal(page,[local('p-alice','Alice'),local('p-bea','Beatrice')]);
 await page.goto('/');
 await page.getByRole('button',{name:'Persona',exact:true}).click();
 const alice=row(page,'Alice');
 await alice.getByRole('button',{name:'Rename Alice',exact:true}).click();
 const field=page.getByLabel('Persona name',{exact:true});
 await expect(field).toBeFocused();await expect(field).toHaveValue('Alice');
 await field.fill('  Alicia ');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 const renamed=row(page,'Alicia');
 await expect(renamed.locator('strong')).toHaveText('Alicia');
 await expect(page.getByRole('status').filter({hasText:'Renamed to Alicia.'})).toHaveCount(1);
 await expect(renamed.getByRole('button',{name:'Rename Alicia',exact:true})).toBeFocused();
 const beatrice=row(page,'Beatrice');
 await beatrice.getByRole('button',{name:'Rename Beatrice',exact:true}).click();
 await page.getByLabel('Persona name',{exact:true}).fill('  ALICIA ');
 await page.keyboard.press('Enter');
 const alert=page.getByRole('alert').filter({hasText:'A persona named ALICIA already exists.'});
 await expect(alert).toBeVisible();
 await expect(page.getByLabel('Persona name',{exact:true})).toHaveValue('  ALICIA ');
 await expect(page.getByLabel('Persona name',{exact:true})).toHaveAttribute('aria-invalid','true');
 await expect(page.getByLabel('Persona name',{exact:true})).toBeFocused();
 await expect(page.getByRole('status').filter({hasText:'Renamed'})).toHaveCount(0);
 await expect(beatrice.locator('strong')).toHaveText('Beatrice');
 expect((await readLocal(page,'personas')).map(p=>p.name)).toEqual(['Alicia','Beatrice']);
});

test('on mobile the rename error scrolls fully into view under the last persona',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await seedLocal(page,[local('p-alice','Alice','ready'),local('p-bea','Beatrice'),local('p-max','Maximiliana Concepción de los Ángeles Rivera-Ortega')]);
 await page.goto('/');
 await page.getByRole('button',{name:'Persona',exact:true}).click();
 const last=row(page,'Maximiliana Concepción de los Ángeles Rivera-Ortega');
 await last.getByRole('button',{name:/^Rename Maximiliana/}).click();
 // The person scrolled just far enough to see the form's buttons at the bottom edge.
 await page.getByRole('button',{name:'Save name',exact:true}).evaluate(e=>e.scrollIntoView({block:'end'}));
 await page.getByLabel('Persona name',{exact:true}).fill('alice');
 await page.keyboard.press('Enter');
 const alert=page.getByRole('alert').filter({hasText:'A persona named alice already exists.'});
 await expect(alert).toBeVisible();
 await expect(alert).toBeInViewport({ratio:1});
 await expect(page.getByLabel('Persona name',{exact:true})).toBeFocused();
 await noOverflow(page);
});

test('private style rename rejects short names, cancel writes nothing, public presets stay unrenamable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await seedLocal(page,[],[local('s-neon','Neon Diner'),local('s-moss','Moss Grid')]);
 const before=await readLocal(page,'styles');
 await page.goto('/');
 await page.getByRole('button',{name:'Style',exact:true}).click();
 await page.getByRole('button',{name:'Private',exact:true}).click();
 const neon=row(page,'Neon Diner');
 await neon.getByRole('button',{name:'Rename Neon Diner',exact:true}).click();
 const field=page.getByLabel('Style name',{exact:true});
 await field.fill('  ab ');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Name must be at least 3 characters'})).toBeVisible();
 await expect(field).toHaveValue('  ab ');
 await noOverflow(page);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(field).toHaveCount(0);
 await expect(neon.getByRole('button',{name:'Rename Neon Diner',exact:true})).toBeFocused();
 await neon.getByRole('button',{name:'Rename Neon Diner',exact:true}).click();
 await page.getByLabel('Style name',{exact:true}).fill('Something else');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByLabel('Style name',{exact:true})).toHaveCount(0);
 await expect(neon.locator('strong')).toHaveText('Neon Diner');
 expect(await readLocal(page,'styles')).toEqual(before);
 await neon.getByRole('button',{name:'Rename Neon Diner',exact:true}).click();
 const long='x'.repeat(81);
 await page.getByLabel('Style name',{exact:true}).fill(long);
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Use a name up to 80 characters.'})).toBeVisible();
 await noOverflow(page);
 await page.getByLabel('Style name',{exact:true}).fill('Neon Diner Night');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(row(page,'Neon Diner Night')).toHaveCount(1);
 expect((await readLocal(page,'styles')).find(s=>s.id==='s-neon')).toEqual({...before.find(s=>s.id==='s-neon'),name:'Neon Diner Night'});
 await page.getByRole('button',{name:'Public',exact:true}).click();
 await expect(page.locator('.public-styles > button').first()).toBeVisible();
 await expect(page.getByRole('button',{name:/^Rename /})).toHaveCount(0);
});

test('renaming the selected persona keeps the selection, references and preparation',async({page})=>{
 await seedLocal(page,[local('p-alice','Alice','ready'),local('p-bea','Beatrice')]);
 await page.goto('/');
 await page.getByRole('button',{name:'Persona',exact:true}).click();
 await row(page,'Alice').locator('.profile-choose').click();
 await expect(page.getByRole('button',{name:'Change persona: Alice',exact:true})).toBeVisible();
 const before=(await readLocal(page,'personas')).find(p=>p.id==='p-alice');
 await page.getByRole('button',{name:'Change persona: Alice',exact:true}).click();
 const alice=row(page,'Alice');
 await expect(alice.locator('svg.lucide-check')).toHaveCount(1);
 await alice.getByRole('button',{name:'Rename Alice',exact:true}).click();
 await page.getByLabel('Persona name',{exact:true}).fill('Alice Rivera');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 const renamed=row(page,'Alice Rivera');
 await expect(renamed.locator('svg.lucide-check')).toHaveCount(1);
 await expect(renamed.getByText('Profile prepared',{exact:true})).toBeVisible();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await expect(page.getByRole('button',{name:'Change persona: Alice Rivera',exact:true})).toBeVisible();
 expect((await readLocal(page,'personas')).find(p=>p.id==='p-alice')).toEqual({...before,name:'Alice Rivera'});
});

function session(id:string){return {access_token:'header.'+Buffer.from(JSON.stringify({sub:id,exp:4102444800})).toString('base64url')+'.signature',refresh_token:'fixture-only-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:id===A?'a@example.test':'b@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-11-08T00:00:00Z'}};}
const cloudRow=(id:string,user_id:string,name:string,profile_status='draft'):Row=>({id,user_id,name,notes:'',refs:[user_id+'/r0.png',user_id+'/r1.png',user_id+'/r2.png'],created_at:'2026-11-10T00:00:00.000Z',profile_status});
async function cloud(page:Page,{styles=[],chats=false}:{styles?:Row[];chats?:boolean}={}){
 const conversations=new Map<string,any>();
 await page.route('**/*',r=>(new URL(r.request().url()).hostname==='127.0.0.1'||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 const personas:Row[]=[cloudRow('aaaaaaaa-0000-4000-8000-000000000001',A,'Alice'),cloudRow('aaaaaaaa-0000-4000-8000-000000000002',A,'Beatrice'),cloudRow('bbbbbbbb-0000-4000-8000-000000000001',B,'Bruno')],patches:any[]=[];
 const png=await sharp({create:{width:20,height:20,channels:3,background:'#2d599a'}}).png().toBuffer();
 await page.route('**/api/jobs',r=>r.fulfill({json:{jobs:[]}}));
 await page.addInitScript(s=>{if(!sessionStorage.getItem('fixture-session')){localStorage.setItem('sb-test-auth-token',JSON.stringify(s));sessionStorage.setItem('fixture-session','1');}},session(A));
 await page.route('**/api/config',r=>r.fulfill({json:{cloud:true,ai:true,openai:true,jev:true,google:false,ownerGate:false,supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test'}}));
 await page.route('https://test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const token=req.headers().authorization?.replace('Bearer ','')||'';let owner=A;try{owner=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;}catch{}
  if(url.pathname.includes('/auth/'))return route.fulfill({json:session(owner).user,headers});
  if(url.pathname.includes('/storage/')&&req.method()==='POST'){const paths=req.postDataJSON().paths||[];return route.fulfill({json:paths.map((p:string)=>({path:p,signedURL:'/object/sign/studio-assets/'+p+'?token=fixture'})),headers});}
  if(url.pathname.includes('/storage/'))return route.fulfill({body:png,contentType:'image/png',headers});
  const table=url.pathname.split('/').pop();
  // Opt-in chat store so a cloud selection can persist its draft like the real library does.
  if(chats&&table==='studio_conversations'){
   if(req.method()!=='GET'){const saved=[req.postDataJSON()].flat().map((c:any)=>{const next={...conversations.get(c.id),...c,user_id:owner};conversations.set(c.id,next);return next;});return route.fulfill({status:201,json:req.headers().accept?.includes('vnd.pgrst.object')?saved[0]:saved,headers});}
   const id=url.searchParams.get('id')?.replace(/^eq\./,'');const found=[...conversations.values()].filter(c=>c.user_id===owner&&(!id||c.id===id));
   return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found,headers});
  }
  if(req.method()!=='GET')return route.fulfill({status:201,body:'',headers});
  const rows=table==='studio_personas'?personas.filter(p=>p.user_id===owner):table==='studio_styles'?styles.filter(s=>s.user_id===owner):[];
  return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows,headers});
 });
 return {personas,styles,patches};
}
function answerPatch(f:{personas:Row[];styles:Row[];patches:any[]},body:any){
 f.patches.push(body);
 const list=body.kind==='style'?f.styles:f.personas;
 const taken=list.some(p=>p.user_id===A&&p.id!==body.id&&p.name.toLowerCase()===String(body.name).trim().toLowerCase());
 if(taken)return {status:409,json:{error:'A '+body.kind+' named '+String(body.name).trim()+' already exists.'}};
 const target=list.find(p=>p.id===body.id)!;target.name=body.name;return {status:200,json:{profile:target}};
}

test('cloud rename sends the trimmed name and shows server duplicate errors without success',async({page})=>{
 const f=await cloud(page);
 await page.route('**/api/profiles',async r=>{if(r.request().method()!=='PATCH')return r.fallback();const out=answerPatch(f,r.request().postDataJSON());await r.fulfill(out);});
 await page.goto('/');
 await page.getByRole('button',{name:'Persona',exact:true}).click();
 await row(page,'Alice').getByRole('button',{name:'Rename Alice',exact:true}).click();
 await page.getByLabel('Persona name',{exact:true}).fill('  Alicia Cloud ');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(row(page,'Alicia Cloud')).toHaveCount(1);
 expect(f.patches[0]).toEqual({kind:'persona',id:'aaaaaaaa-0000-4000-8000-000000000001',name:'Alicia Cloud'});
 await row(page,'Beatrice').getByRole('button',{name:'Rename Beatrice',exact:true}).click();
 await page.getByLabel('Persona name',{exact:true}).fill('alicia cloud');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'A persona named alicia cloud already exists.'})).toBeVisible();
 await expect(page.getByLabel('Persona name',{exact:true})).toHaveValue('alicia cloud');
 await expect(page.getByRole('status').filter({hasText:'Renamed to alicia'})).toHaveCount(0);
 await expect(row(page,'Beatrice')).toHaveCount(1);
});

test('cloud private style rename sends the style request and keeps the selection, references and preparation',async({page})=>{
 const neonId='cccccccc-0000-4000-8000-000000000001';
 const f=await cloud(page,{chats:true,styles:[cloudRow(neonId,A,'Neon Diner','ready'),cloudRow('cccccccc-0000-4000-8000-000000000002',A,'Moss Grid'),cloudRow('dddddddd-0000-4000-8000-000000000001',B,'Bruno Style')]});
 const before=structuredClone(f.styles.find(s=>s.id===neonId)!);
 await page.route('**/api/profiles',async r=>{if(r.request().method()!=='PATCH')return r.fallback();await r.fulfill(answerPatch(f,r.request().postDataJSON()));});
 await page.goto('/');
 await page.getByRole('button',{name:'Style',exact:true}).click();
 await expect(row(page,'Bruno Style')).toHaveCount(0);
 await row(page,'Neon Diner').locator('.profile-choose').click();
 await page.getByRole('button',{name:'Change style: Neon Diner',exact:true}).click();
 const neon=row(page,'Neon Diner');
 await expect(neon.locator('svg.lucide-check')).toHaveCount(1);
 await expect(neon.getByText('Profile prepared',{exact:true})).toBeVisible();
 await expect(neon.locator('.profile-cover img')).toHaveCount(3);
 await neon.getByRole('button',{name:'Rename Neon Diner',exact:true}).click();
 await page.getByLabel('Style name',{exact:true}).fill('  Neon Diner Night ');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 const renamed=row(page,'Neon Diner Night');
 await expect(renamed.locator('strong')).toHaveText('Neon Diner Night');
 expect(f.patches).toEqual([{kind:'style',id:neonId,name:'Neon Diner Night'}]);
 await expect(page.getByRole('status').filter({hasText:'Renamed to Neon Diner Night.'})).toHaveCount(1);
 await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
 await expect(renamed.getByRole('button',{name:'Rename Neon Diner Night',exact:true})).toBeFocused();
 await expect(renamed.locator('svg.lucide-check')).toHaveCount(1);
 await expect(renamed.getByText('Profile prepared',{exact:true})).toBeVisible();
 await expect(renamed.locator('.profile-cover img')).toHaveCount(3);
 await expect(row(page,'Moss Grid').locator('svg.lucide-check')).toHaveCount(0);
 expect(f.styles.find(s=>s.id===neonId)).toEqual({...before,name:'Neon Diner Night'});
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await expect(page.getByRole('button',{name:'Change style: Neon Diner Night',exact:true})).toBeVisible();
});

test('an owner switch during a cloud rename never shows the previous owner result',async({page})=>{
 const f=await cloud(page);let release!:()=>void,entered!:()=>void;const hold=new Promise<void>(r=>release=r),waiting=new Promise<void>(r=>entered=r);
 await page.route('**/api/profiles',async r=>{if(r.request().method()!=='PATCH')return r.fallback();entered();await hold;await r.fulfill(answerPatch(f,r.request().postDataJSON()));});
 await page.goto('/');
 await page.getByRole('button',{name:'Persona',exact:true}).click();
 await row(page,'Alice').getByRole('button',{name:'Rename Alice',exact:true}).click();
 await page.getByLabel('Persona name',{exact:true}).fill('Alicia Private');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 await waiting;
 await expect(page.getByRole('button',{name:'Saving…',exact:true})).toBeDisabled();
 await page.evaluate(s=>{localStorage.setItem('sb-test-auth-token',JSON.stringify(s));const bc=new BroadcastChannel('sb-test-auth-token');bc.postMessage({event:'SIGNED_IN',session:s});setTimeout(()=>bc.close(),100);},session(B));
 await expect(page.getByRole('dialog')).toBeHidden();
 release();
 await expect.poll(()=>f.personas.find(p=>p.user_id===A&&p.name==='Alicia Private')?.id).toBeTruthy();
 await page.waitForTimeout(500);
 await expect(page.getByRole('alert').filter({hasText:'Alicia Private'})).toHaveCount(0);
 await page.getByRole('button',{name:'Persona',exact:true}).click();
 await expect(row(page,'Bruno')).toHaveCount(1);
 await expect(page.getByText('Alicia Private')).toHaveCount(0);
 await expect(page.getByRole('alert').filter({hasText:'Your account changed'})).toHaveCount(0);
 await expect(page.getByRole('status').filter({hasText:'Renamed'})).toHaveCount(0);
 await expect(page.getByLabel('Persona name',{exact:true})).toHaveCount(0);
 await expect(row(page,'Bruno').getByRole('button',{name:'Rename Bruno',exact:true})).toBeEnabled();
});
