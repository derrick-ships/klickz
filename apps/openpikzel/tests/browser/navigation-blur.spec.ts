import {test,expect} from '@playwright/test';
test('mobile navigation applies blur and preserves the prompt',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/studio');const prompt=page.getByLabel('Describe your thumbnail',{exact:true});await prompt.fill('Keep this direction visible beneath navigation');await prompt.blur();await page.evaluate(()=>window.scrollTo(0,0));
 await expect(page.locator('.workspace-main')).toHaveCSS('visibility','visible');
 await page.getByRole('button',{name:'Open sidebar',exact:true}).click();await expect(page.locator('.workspace-main')).toHaveAttribute('inert','');
 await expect(page.locator('.workspace-main')).toHaveCSS('filter','blur(6px)');
 await expect(page.locator('.workspace-main')).toHaveCSS('visibility','visible');
 await expect(page.locator('.workspace-main')).toHaveCSS('opacity','1');
 await expect(prompt).toHaveValue('Keep this direction visible beneath navigation');
 await page.screenshot({path:'evidence/navigation-blur-390.png'});await page.getByRole('button',{name:'Close sidebar',exact:true}).click();await expect(prompt).toHaveValue('Keep this direction visible beneath navigation');await expect(page.getByRole('button',{name:'Open sidebar',exact:true})).toBeFocused();
});
test('navigation can reverse during motion and stays instant with reduced motion and keyboard',async({page})=>{
 await page.setViewportSize({width:768,height:1000});await page.goto('/');const main=page.locator('.workspace-main');await page.getByLabel('Describe your thumbnail',{exact:true}).fill('A persistent working draft');
 await page.getByRole('button',{name:'Open sidebar',exact:true}).click();await page.getByRole('button',{name:'Close sidebar',exact:true}).dispatchEvent('click');await page.getByRole('button',{name:'Open sidebar',exact:true}).dispatchEvent('click');await expect(page.locator('.sidebar-scrim')).toHaveCSS('opacity','1');await expect(main).toHaveCSS('visibility','visible');await expect(main).toHaveCSS('opacity','1');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.sidebar-scrim')).toHaveCSS('transition-duration','0s');await page.keyboard.press('Escape');await expect(main).not.toHaveAttribute('inert','');await page.getByRole('button',{name:'Open sidebar',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.sidebar-scrim')).toHaveCSS('transition-duration','0s');await page.screenshot({path:'evidence/navigation-reduced-768.png'});await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1000});await expect(main).not.toHaveAttribute('inert','');await expect(page.getByLabel('Describe your thumbnail',{exact:true})).toHaveValue('A persistent working draft');await page.screenshot({path:'evidence/navigation-desktop-1440.png'});
});
test('voice capture controls and status are removed from the composer',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Voice input',exact:true})).toHaveCount(0);await expect(page.getByText(/Voice input stopped/)).toHaveCount(0);await expect(page.getByLabel('Describe your thumbnail',{exact:true})).toBeVisible();
});
test('image model picker uses supplied white logos and applies only supported choices',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('button',{name:/^Rendering model:/})).toHaveAccessibleDescription('Flare 2.6');await page.getByRole('button',{name:/^Rendering model:/}).click();const dialog=page.getByRole('dialog',{name:'Image models',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Flare 2.6',exact:true})).toHaveAttribute('aria-pressed','true');await expect(dialog.locator('img.provider-logo')).toHaveCount(4);
 await dialog.locator('img.provider-logo').evaluateAll(xs=>Promise.all(xs.map(i=>(i as HTMLImageElement).decode())));const filters=await dialog.locator('img.provider-logo').evaluateAll(xs=>xs.map(e=>getComputedStyle(e).filter));expect(filters.every(x=>x.includes('brightness(0)')&&x.includes('invert(1)'))).toBe(true);
 await expect(dialog).toHaveCSS('opacity','1');await page.screenshot({path:'evidence/model-picker-white-390.png'});await dialog.getByLabel('Search image models',{exact:true}).fill('Google');await expect(dialog.getByRole('button',{name:'Flare 2.6',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Gemini Pro',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:/^Rendering model:/})).toHaveText('Gemini Pro');await expect(page.getByRole('button',{name:/^Rendering model:/})).toBeFocused();await expect(page.getByRole('button',{name:/^Rendering model:/})).toHaveAccessibleDescription('Gemini Pro');await page.getByRole('button',{name:'Open sidebar',exact:true}).click();await expect(page.locator('aside.sidebar .model-trigger')).toHaveCount(0);await page.keyboard.press('Escape');await page.getByRole('button',{name:/^Rendering model:/}).click();await dialog.getByRole('button',{name:'Flare 2.6',exact:true}).click();await expect(page.getByRole('button',{name:/^Rendering model:/})).toHaveAccessibleDescription('Flare 2.6');
});

test('navigation backdrop stays transparent when hovered and touched',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/studio');await page.getByRole('button',{name:'Open sidebar',exact:true}).click();
 const scrim=page.locator('.sidebar-scrim');await scrim.hover({position:{x:380,y:300}});
 await expect(scrim).toHaveCSS('background-color','rgba(5, 5, 7, 0.14)');
 await page.screenshot({path:'evidence/navigation-hover-visible-390.png'});
 await page.keyboard.press('Escape');await expect(page.locator('.workspace-main')).not.toHaveAttribute('inert','');
});
