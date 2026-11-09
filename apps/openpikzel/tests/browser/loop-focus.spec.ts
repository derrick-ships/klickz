import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test('generation controls keep visible keyboard focus against their red surface',async({page})=>{
 await page.route('**/*',r=>(new URL(r.request().url()).hostname==='127.0.0.1'||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 await page.route('**/api/config',r=>r.fulfill({json:{cloud:false,ai:false,openai:false,jev:false,google:false}}));
 const readings:any[]=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto('/studio');await expect(page.getByLabel('Prompt',{exact:true})).toBeVisible();
  const primary=page.locator('.generate-split .primary-button'),batch=page.getByRole('combobox',{name:'Batch size',exact:true});
  await primary.focus();await page.keyboard.press('Tab');await expect(batch).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(primary).toBeFocused();
  for(const [name,element] of [['primary',primary],['batch',batch]] as const){
   await element.focus();await expect(element).toBeFocused();await element.scrollIntoViewIfNeeded();
   const reading=await element.evaluate(el=>{const style=getComputedStyle(el),surface=getComputedStyle(el.closest('.generate-split')!);return{color:style.outlineColor,width:style.outlineWidth,offset:style.outlineOffset,style:style.outlineStyle,gradient:surface.backgroundImage,focusVisible:el.matches(':focus-visible')};});
   expect(reading.focusVisible).toBe(true);expect(parseFloat(reading.width)).toBeGreaterThanOrEqual(2);expect(reading.style).toBe('solid');readings.push({viewport:width,control:name,...reading});
   await page.screenshot({path:'evidence/loop-focus-'+name+'-'+width+'.png'});
  }
 }
 await writeFile('evidence/loop-focus.json',JSON.stringify({method:'Rendered keyboard traversal and computed focus styles. Color ratios are separately calculated in loop-contrast.json; screenshots require visual review.',readings},null,2));
});