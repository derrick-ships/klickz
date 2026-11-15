import {test,expect} from '@playwright/test';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
async function upload(page:any){
 await page.route('**/*',(r:any)=>(new URL(r.request().url()).hostname==='127.0.0.1'||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 await page.route('**/api/config',(r:any)=>r.fulfill({json:{cloud:false,ai:false,openai:false,jev:false,google:false}}));
 await page.goto('/?mode=analyze');await page.getByLabel('Video title',{exact:true}).fill('Fixture: saved local reference');
 await page.getByLabel('Upload thumbnail references').setInputFiles('public/brand/signal.webp');
 await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();
}
test('local uploaded images survive reload and download as YouTube-ready JPEG under 2 MB',async({page})=>{
 await upload(page);await page.reload();await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name: "Download image",exact:true}).click();const download=await downloading;const bytes=await readFile((await download.path())!);const metadata=await sharp(bytes).metadata();
 expect(metadata.format).toBe('jpeg');expect(bytes.length).toBeLessThan(2*1024*1024);expect(metadata.width).toBeGreaterThan(100);expect(metadata.height).toBeGreaterThan(100);
 const storage=await page.evaluate(()=>new Promise<any>((resolve,reject)=>{const r=indexedDB.open('derrick-thumbnail-studio');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('assets'),q=tx.objectStore('assets').getAll();q.onsuccess=()=>resolve(q.result.map(a=>({bytes:a.bytes instanceof ArrayBuffer,hasBlob:a.blob instanceof Blob,mime:a.mime})));tx.oncomplete=()=>db.close();};}));
 expect(storage.length).toBeGreaterThan(0);expect(storage.every((a:any)=>a.bytes&&!a.hasBlob&&a.mime==='image/png')).toBe(true);
});
test('existing Blob asset records remain readable without migration',async({page,browserName})=>{
 test.skip(browserName==='webkit','This WebKit runtime cannot create legacy Blob records; byte-backed persistence is tested separately.');
 await upload(page);
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const r=indexedDB.open('derrick-thumbnail-studio');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets'),q=store.getAll();q.onsuccess=()=>{for(const a of q.result)store.put({id:a.id,blob:new Blob([a.bytes],{type:a.mime})});};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
 await page.reload();await expect(page.getByRole('region',{name:'Thumbnail review studio'})).toBeVisible();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name: "Download image",exact:true}).click();const bytes=await readFile((await(await downloading).path())!);expect((await sharp(bytes).metadata()).format).toBe('jpeg');
});