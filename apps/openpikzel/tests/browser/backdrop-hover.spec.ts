import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
test('mobile backdrop preserves content through pointer transition, touch dismissal and reduced motion',async({page})=>{
 for(const width of [320,390,430]){
 await page.setViewportSize({width,height:844});await page.goto('/studio');
 await page.getByRole('button',{name:'Open sidebar',exact:true}).tap();
 await page.locator('.sidebar').evaluate(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=100}));
 await page.screenshot({path:'evidence/backdrop-'+width+'-transition.png'});
 await page.locator('.sidebar').evaluate(e=>e.getAnimations().forEach(a=>a.finish()));
 await page.locator('.sidebar-scrim').hover({position:{x:width-10,y:300}});
 await expect(page.locator('.sidebar-scrim')).toHaveCSS('background-color','rgba(5, 5, 7, 0.14)');
 await page.screenshot({path:'evidence/backdrop-'+width+'-open.png'});
 await page.touchscreen.tap(width-10,300);await expect(page.locator('.workspace-main')).not.toHaveAttribute('inert','');await expect(page.locator('.sidebar')).toHaveCSS('visibility','hidden');
 await page.screenshot({path:'evidence/backdrop-'+width+'-closed.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Open sidebar',exact:true}).tap();await expect(page.locator('.sidebar-scrim')).toHaveCSS('background-color','rgba(5, 5, 7, 0.14)');await expect(page.locator('.sidebar')).toHaveCSS('transition-duration','0s');await page.screenshot({path:'evidence/backdrop-'+width+'-reduced.png'});await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
 }
});
