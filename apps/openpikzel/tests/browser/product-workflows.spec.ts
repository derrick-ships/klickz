import {test,expect} from '@playwright/test';
import sharp from 'sharp';
const image=async(color:string,name='reference.png')=>({name,mimeType:'image/png',buffer:await sharp({create:{width:800,height:450,channels:3,background:color}}).png().toBuffer()});
test('chats restore drafts, names and selected conversation after reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'New chat',exact:true}).click();
 await page.getByLabel('Prompt',{exact:true}).fill('A skeleton holding a smartphone, a clear visual promise');
 await expect(page.locator('.chat-save-state')).toHaveText('Saved');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('heading',{name:'Concept saved.'})).toBeVisible();
 await page.getByRole('button',{name:'Rename chat',exact:true}).click();await page.getByLabel('Chat name',{exact:true}).fill('Split Face Thumbnails');await page.getByRole('button',{name:'Save chat name',exact:true}).click();
 await page.getByRole('button',{name:'New chat',exact:true}).click();await page.getByLabel('Prompt',{exact:true}).fill('A mansion comparison with a truthful before and after');await expect(page.locator('.chat-save-state')).toHaveText('Saved');
 await page.getByLabel('Search your chats').fill('Split Face');
 await page.getByRole('button',{name:'Open chat: Split Face Thumbnails',exact:true}).click();
 await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue(/skeleton holding/);await page.reload();await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue(/skeleton holding/);
 await expect(page.locator('.chat-title')).toContainText('Split Face Thumbnails');
 await page.screenshot({path:'evidence/product-chats-desktop.png',fullPage:true});
});
test('v1 library survives upgrade, comparison supports keyboard and feedback saves privately',async({page})=>{
 const original=await image('#3a5c8c'),after=await image('#d73447'),ids=['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
 await page.goto('/connect');await page.evaluate(async({a,b,ids})=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('derrick-thumbnail-studio',1);r.onupgradeneeded=()=>{for(const s of ['creations','personas','styles','assets'])r.result.createObjectStore(s,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const tx=db.transaction(['creations','assets'],'readwrite');for(const [i,data]of[a,b].entries()){const blob=new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/png'});tx.objectStore('assets').put({id:'img-'+i,blob});tx.objectStore('creations').put({id:ids[i],title:i?'Test revised thumbnail':'Test original thumbnail',prompt:'A saved factual thumbnail concept',mode:i?'edit':'generate',style:'Auto',persona_id:null,parent_id:i?ids[0]:null,image_path:'img-'+i,status:'ready',favorite:false,created_at:new Date(Date.now()+i).toISOString(),settings:{model:'flare',quality:'low',complexity:'low',format:'long',batch:1}});}await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 },{a:original.buffer.toString('base64'),b:after.buffer.toString('base64'),ids});
 await page.goto('/');await page.getByRole('button',{name:'Test revised thumbnail',exact:true}).click();
 await page.getByRole('button',{name:'Compare before & after',exact:true}).click();const range=page.getByRole('slider',{name:'Before and after comparison'});await expect(range).toHaveValue('50');await range.focus();await page.keyboard.press('ArrowRight');await expect(range).toHaveValue('51');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'evidence/product-compare-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'Leave feedback',exact:true}).click();await page.getByLabel('Your feedback',{exact:true}).fill('The revised composition is clear and useful.');await page.getByRole('button',{name:'Submit feedback',exact:true}).click();await expect(page.getByText('Feedback saved with this thumbnail. Thank you.',{exact:true})).toBeVisible();
 const saved=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('derrick-thumbnail-studio');q.onsuccess=()=>r(q.result);});return await new Promise<any[]>(r=>{const q=db.transaction('feedback').objectStore('feedback').getAll();q.onsuccess=()=>{r(q.result);db.close();};});});expect(saved).toHaveLength(1);expect(saved[0].creation_id).toBe(ids[1]);
});
test('Persona tutorial, inline errors, three-photo permission flow and preference persist',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Persona',exact:true}).click();await page.getByRole('button',{name:'Create persona',exact:true}).click();await expect(page.getByRole('heading',{name:'Persona Guidelines',exact:true})).toBeVisible();
 await expect(page.locator('.guideline-photo')).toHaveCount(2);await page.screenshot({path:'evidence/product-persona-guide-desktop.png'});await page.setViewportSize({width:320,height:844});await page.screenshot({path:'evidence/product-persona-guide-320.png'});await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Use three different photographs'})).toBeVisible();await page.getByLabel('Don’t show this tutorial again').check();await page.getByRole('button',{name:'Skip Tutorial',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('ab');await page.getByRole('button',{name:'Create persona',exact:true}).click();await expect(page.getByText('Name must be at least 3 characters',{exact:true})).toBeVisible();await expect(page.getByLabel('Name',{exact:true})).toHaveAttribute('aria-invalid','true');
 await page.getByLabel('Name',{exact:true}).fill('Alice');await page.getByLabel('Profile reference photos').setInputFiles(await Promise.all(['#ac524e','#659f85','#747bcb'].map((c,i)=>image(c,'person-'+i+'.png'))));await page.getByLabel('I have permission to use these photos and this likeness.').check();
 await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await page.screenshot({path:'evidence/product-persona-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Create persona',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'Alice',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Alice',exact:true}).click();await expect(page.getByRole('img',{name:'Alice reference'})).toHaveCount(3);await page.getByRole('button',{name:'Create persona',exact:true}).click();await expect(page.getByRole('heading',{name:'Create Your Persona',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Persona Guidelines',exact:true})).toHaveCount(0);
});
test('YouTube Style browser preserves selection across orders and saves three references',async({page})=>{
 const videos=Array.from({length:5},(_,i)=>({id:String(i+1).padStart(11,'0'),title:'Reference video '+(i+1),thumbnail:'https://i.ytimg.com/vi/'+String(i+1).padStart(11,'0')+'/hqdefault.jpg',views:10000-i*500,duration:'4:02',publishedAt:'2026-11-08T00:00:00Z'}));
 const channel={id:'UCabcdefghijklmnopqrstuv',name:'Your reference channel',avatar:'',subscribers:12000,videos:500};
 await page.route('**/api/youtube',async route=>{await route.fulfill({json:{channel,videos,nextPageToken:null,notice:'Fixture public channel data. No YouTube API request.'}});});
 await page.route('**/api/youtube/reference',async route=>{const id=route.request().postDataJSON().videoId,buffer=(await image(['#aa4556','#4a78a4','#87a45a'][Number(id)-1]||'#c95f33')).buffer;await route.fulfill({contentType:'image/png',body:buffer});});
 await page.route('https://i.ytimg.com/**',async route=>route.fulfill({contentType:'image/png',body:(await image('#4b5564')).buffer}));
 await page.goto('/');await page.getByRole('button',{name:'Style',exact:true}).click();await page.getByRole('button',{name:'Create style',exact:true}).click();await page.getByRole('button',{name:'YouTube Channel',exact:true}).click();await page.getByLabel('YouTube channel',{exact:true}).fill('@creator');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:channel.name,exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Use 3 selected thumbnails',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Select Reference video 1',exact:true}).click();await page.getByRole('button',{name:'Popular',exact:true}).click();await expect(page.getByRole('button',{name:'Select Reference video 1',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Select Reference video 2',exact:true}).click();await page.getByRole('button',{name:'Select Reference video 3',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'evidence/product-youtube-mobile.png',fullPage:true});await page.getByRole('button',{name:'Use 3 selected thumbnails',exact:true}).click();await page.getByRole('button',{name:'Create style',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:channel.name,exact:true})).toBeVisible();
});

test('switching immediately flushes a draft and library selection restores its own chat context',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'New chat',exact:true}).click();await page.getByLabel('Prompt',{exact:true}).fill('Chat A original private draft');await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.locator('.chat-save-state')).toHaveText('Saved');
 await page.getByRole('button',{name:'New chat',exact:true}).click();await page.getByLabel('Prompt',{exact:true}).fill('Chat B independent saved draft');await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.locator('.chat-save-state')).toHaveText('Saved');
 await page.locator('.chat-row').filter({hasText:'Chat A original private draft'}).click();
 await page.getByLabel('Prompt',{exact:true}).fill('Chat A last-second edit must not be lost');
 await page.locator('.chat-row').filter({hasText:'Chat B independent saved draft'}).click();
 await page.locator('.chat-row').filter({hasText:'Chat A original private draft'}).click();await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue('Chat A last-second edit must not be lost');
 await page.getByRole('button',{name:'My creations',exact:true}).click();
 await page.locator('.creation-grid article').filter({hasText:'Chat B independent saved draft'}).getByRole('button').first().click();
 await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue('Chat B independent saved draft');
 await expect(page.locator('.chat-save-state')).toHaveText('Saved');
 await page.getByRole('button',{name:'Rename chat',exact:true}).click();await page.getByLabel('Chat name',{exact:true}).fill('Manual name must stay');await page.getByRole('button',{name:'Save chat name'}).click();await page.getByLabel('Prompt',{exact:true}).fill('A typed revision after renaming');await expect(page.locator('.chat-save-state')).toHaveText('Saved');await page.reload();await expect(page.locator('.chat-title')).toContainText('Manual name must stay');
});
