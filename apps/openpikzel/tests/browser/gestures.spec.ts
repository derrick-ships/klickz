import {test,expect,type Page} from '@playwright/test';
import { openResultMore } from "./helpers/more-options";
import {reviewFixture} from './helpers/review-fixture';
async function fixture(page:Page){
 await reviewFixture(page,false);
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('derrick-thumbnail-studio');q.onsuccess=()=>r(q.result);});const tx=db.transaction(['creations','conversations'],'readwrite'),rows=tx.objectStore('creations').getAll();rows.onsuccess=()=>{const item=rows.result.find(c=>c.image_path),chatId='77777777-7777-4777-8777-777777777777',ids=Array.from({length:6},(_,i)=>'88888888-8888-4888-8888-'+String(i+1).padStart(12,'0'));for(const [i,id]of ids.entries())tx.objectStore('creations').put({...item,id,title:'Gesture revision '+(i+1),prompt:'Gesture fixture '+(i+1),conversation_id:chatId,parent_id:i?ids[i-1]:null,created_at:new Date(Date.UTC(2026,10,8,10,i)).toISOString()});tx.objectStore('conversations').put({id:chatId,title:'Gesture inspection',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),draft:{prompt:'Gesture fixture',title:'Gesture revision 6',tool:'analyze',settings:item.settings,selection:ids[5],refs:[]}});localStorage.setItem('openpikzels.activeChat.local',chatId);};await new Promise<void>((r,j)=>{tx.oncomplete=()=>r();tx.onerror=()=>j(tx.error);});db.close();});await page.reload();await expect(page.locator('details.result-more > summary')).toBeVisible();
}
async function matrix(page:Page){return page.locator('.image-inspector-photo').evaluate(e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return {scale:m.a,x:m.e,y:m.f};});}
test('comparison maps pointer coordinates directly, ignores other fingers and preserves keyboard and scroll',async({page})=>{
 await fixture(page);await openResultMore(page);await page.getByRole('button',{name:'Compare before & after',exact:true}).click();const range=page.getByRole('slider',{name:'Before and after comparison'}),box=(await range.boundingBox())!;
 await page.mouse.move(box.x+box.width*.25,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.75,box.y+box.height/2);expect(Number(await range.inputValue())).toBeCloseTo(75,0);
 await range.dispatchEvent('pointerdown',{pointerId:99,pointerType:'touch',clientX:box.x,clientY:box.y});await range.dispatchEvent('pointermove',{pointerId:99,pointerType:'touch',clientX:box.x,clientY:box.y});expect(Number(await range.inputValue())).toBeCloseTo(75,0);
 await page.mouse.up();await range.focus();await page.keyboard.press('ArrowRight');await expect(range).toHaveValue('76');await page.mouse.move(box.x+box.width*.2,box.y+box.height/2);await page.mouse.down();await range.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await expect(range).toHaveValue('76');
 expect(await range.evaluate(e=>getComputedStyle(e).touchAction)).toContain('pan-y');expect(await range.evaluate(e=>getComputedStyle(e).touchAction)).toContain('pinch-zoom');
});
test('inspection has anchored zoom, direct pan, keyboard recovery and safe browser zoom',async({page})=>{
 await fixture(page);await openResultMore(page);await page.getByRole('button',{name:'Inspect image',exact:true}).click();const surface=page.getByRole('group',{name:'Zoomable thumbnail',exact:true});await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeVisible();expect(await surface.evaluate(e=>getComputedStyle(e).touchAction)).toContain('pinch-zoom');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.getByLabel('Image zoom',{exact:true})).toHaveText('200%');const box=(await surface.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2);await page.mouse.up();expect((await matrix(page)).x).toBeGreaterThan(30);await page.screenshot({path:'evidence/gestures-inspect-desktop.png'});
 await surface.focus();await page.keyboard.press('Home');await expect(page.getByLabel('Image zoom',{exact:true})).toHaveText('100%');expect(await matrix(page)).toEqual({scale:1,x:0,y:0});
 await page.mouse.dblclick(box.x+box.width/2,box.y+box.height/2);await expect(page.getByLabel('Image zoom',{exact:true})).toHaveText('200%');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Fit image',exact:true}).click();await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await page.screenshot({path:'evidence/gestures-inspect-320.png'});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('pinch carries the midpoint, ignores a third touch and recovers after cancellation',async({page})=>{
 await fixture(page);await openResultMore(page);await page.getByRole('button',{name:'Inspect image',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();const s=page.getByRole('group',{name:'Zoomable thumbnail',exact:true}),box=(await s.boundingBox())!,cy=box.y+box.height/2,cx=box.x+box.width/2;
 for(const[id,x]of[[21,cx-40],[22,cx+40]])await s.dispatchEvent('pointerdown',{pointerId:id,pointerType:'touch',clientX:x,clientY:cy});
 await s.dispatchEvent('pointermove',{pointerId:21,pointerType:'touch',clientX:cx-60,clientY:cy});await s.dispatchEvent('pointermove',{pointerId:22,pointerType:'touch',clientX:cx+60,clientY:cy});expect((await matrix(page)).scale).toBeCloseTo(3,1);
 await s.dispatchEvent('pointerdown',{pointerId:23,pointerType:'touch',clientX:cx+200,clientY:cy});await s.dispatchEvent('pointermove',{pointerId:23,pointerType:'touch',clientX:cx-200,clientY:cy});expect((await matrix(page)).scale).toBeCloseTo(3,1);
 await s.dispatchEvent('pointercancel',{pointerId:21,pointerType:'touch'});await s.dispatchEvent('pointercancel',{pointerId:22,pointerType:'touch'});await page.getByRole('button',{name:'Fit image',exact:true}).click();expect(await matrix(page)).toEqual({scale:1,x:0,y:0});
});
test('revision strip has visible scrolling controls without opening a different image',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);const strip=page.getByRole('region',{name:'Thumbnail revision history',exact:true}),next=page.getByRole('button',{name:'Next revisions',exact:true});await expect(next).toBeEnabled();await expect(page.getByRole('button',{name:'Previous revisions',exact:true})).toBeDisabled();await next.focus();await page.keyboard.press('Enter');await expect.poll(()=>strip.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);await expect(page.getByRole('button',{name:'Previous revisions',exact:true})).toBeEnabled();await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();await page.screenshot({path:'evidence/gestures-history-390.png'});
});

test('resizing during a pan cancels the old pointer baseline',async({page})=>{
 await fixture(page);await openResultMore(page);await page.getByRole('button',{name:'Inspect image',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();const s=page.getByRole('group',{name:'Zoomable thumbnail',exact:true}),b=(await s.boundingBox())!,cx=b.x+b.width/2,cy=b.y+b.height/2;
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+200,cy);await page.setViewportSize({width:320,height:844});await expect.poll(async()=>Math.abs((await matrix(page)).x)).toBeLessThan(150);
 const before=await matrix(page);await page.mouse.move(cx+199,cy);expect((await matrix(page)).x).toBeCloseTo(before.x,1);await page.mouse.up();
});
test('comparison touch cancellation restores the committed split instead of changing it during page scroll',async({page})=>{
 await fixture(page);await openResultMore(page);await page.getByRole('button',{name:'Compare before & after',exact:true}).click();const range=page.getByRole('slider',{name:'Before and after comparison'}),b=(await range.boundingBox())!;
 await range.dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch',button:0,clientX:b.x+b.width*.1,clientY:b.y+60});await range.dispatchEvent('pointermove',{pointerId:7,pointerType:'touch',clientX:b.x+b.width*.1+2,clientY:b.y+110});await range.dispatchEvent('pointercancel',{pointerId:7,pointerType:'touch'});
 await expect(range).toHaveValue('50');
});
test('new image sources cannot inherit a live pinch from an expired preview',async({page})=>{
 const {buildSync}=await import('esbuild'),{readFileSync}=await import('node:fs');const first='data:image/webp;base64,'+readFileSync('public/brand/signal.webp').toString('base64'),second='data:image/webp;base64,'+readFileSync('public/brand/aperture.webp').toString('base64');
 const bundle=buildSync({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ImageInspector}from'./src/components/creative/image-inspector';const root=createRoot(document.getElementById('fixture'));window.updateImage=(src)=>root.render(<ImageInspector src={src} title="Source isolation"/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic'}).outputFiles[0].text;
 await page.goto('about:blank');await page.setContent('<html><head></head><body><div id="fixture"></div></body></html>');await page.addStyleTag({content:'.image-inspector-surface{position:relative;width:400px;height:300px;overflow:hidden}.image-inspector-photo{width:100%;height:100%;object-fit:contain}'});await page.addScriptTag({content:bundle});
 await page.evaluate(src=>(window as any).updateImage(src),first);await page.locator('.image-inspector-photo').evaluate(i=>(i as HTMLImageElement).decode());await page.getByRole('button',{name:'Zoom in',exact:true}).click();const s=page.getByRole('group',{name:'Zoomable thumbnail',exact:true}),b=(await s.boundingBox())!,cy=b.y+150;
 for(const[id,x]of[[11,b.x+150],[12,b.x+250]])await s.dispatchEvent('pointerdown',{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:cy});
 await s.dispatchEvent('pointermove',{pointerId:12,pointerType:'touch',clientX:b.x+290,clientY:cy});expect((await matrix(page)).scale).toBeGreaterThan(2);
 await page.evaluate(src=>(window as any).updateImage(src),second);await expect(page.getByLabel('Image zoom',{exact:true})).toHaveText('100%');await page.locator('.image-inspector-photo').evaluate(i=>(i as HTMLImageElement).decode());
 await s.dispatchEvent('pointerdown',{pointerId:30,pointerType:'touch',button:0,clientX:b.x+200,clientY:cy});await s.dispatchEvent('pointermove',{pointerId:30,pointerType:'touch',clientX:b.x+205,clientY:cy});expect(await matrix(page)).toEqual({scale:1,x:0,y:0});await s.dispatchEvent('pointercancel',{pointerId:30});
});
test('real browser touch input tracks comparison and image pinch without calling AI',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await openResultMore(page);await page.getByRole('button',{name:'Compare before & after',exact:true}).click();const range=page.getByRole('slider',{name:'Before and after comparison'}),b=(await range.boundingBox())!,y=b.y+b.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.2,y}]});
 for(const n of [.3,.45,.6,.8])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*n,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(range).toHaveValue('80');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await openResultMore(page);await page.getByRole('button',{name:'Inspect image',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();const s=page.getByRole('group',{name:'Zoomable thumbnail',exact:true}),r=(await s.boundingBox())!,cx=r.x+r.width/2,cy=r.y+r.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
 for(const distance of [34,39,45])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-distance,y:cy,id:1},{x:cx+distance,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>Number((await page.getByLabel('Image zoom',{exact:true}).textContent())?.replace('%',''))).toBeGreaterThan(250);await page.screenshot({path:'evidence/gestures-touch-inspect-390.png'});
});
