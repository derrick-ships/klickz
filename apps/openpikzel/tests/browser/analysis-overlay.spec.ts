import {test,expect} from '@playwright/test';
import {reviewFixture} from './helpers/review-fixture';
test('analysis overlay explains partial pillars and offers a free copyable prompt',async({page})=>{
 await reviewFixture(page,true);await page.getByRole('button',{name:'Open analysis details',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Thumbnail Analysis',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Partial assessment',exact:true})).toBeVisible();
 const items=page.locator('.analysis-more');await expect(items).toHaveCount(5);await items.filter({hasText:'Clarity'}).locator('summary').click();await expect(items.filter({hasText:'Clarity'}).getByText('Working for you',{exact:true})).toBeVisible();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as any).__fixtureCopy=text;}},configurable:true}));
 await page.getByRole('button',{name:'Copy improvement prompt',exact:true}).click();await expect(page.getByRole('button',{name:'Prompt copied',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).__fixtureCopy)).toContain('preserving');
 await page.screenshot({path:'evidence/product-analysis-desktop.png'});
 for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:'evidence/product-analysis-'+width+'.png'});}
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('button',{name:'Open analysis details',exact:true})).toBeFocused();
});
