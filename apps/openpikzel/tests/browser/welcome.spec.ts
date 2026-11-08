import {test,expect} from '@playwright/test';
test.use({storageState:{cookies:[],origins:[]}});
test('fresh welcome uses the requested headline with honest costs, privacy and real setup paths',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{level:1,name:'GET MILLIONS OF VIEWS',exact:true})).toBeVisible();await expect(page.getByText('Without adding another subscription*',{exact:true})).toBeVisible();await expect(page.getByText(/views are not guaranteed/i)).toBeVisible();await expect(page.getByText(/OpenPikzels has no subscription fee/i)).toBeVisible();await expect(page.getByText(/provider.*(?:costs|charges|pricing)/i).first()).toBeVisible();
 await expect(page.getByRole('link',{name:'Connect API keys',exact:true})).toHaveAttribute('href','/connect');await expect(page.getByRole('link',{name:'Connect my ChatGPT plan',exact:true})).toHaveAttribute('href','/connect#chatgpt');await expect(page.getByRole('link',{name:'Connect an agent',exact:true})).toHaveAttribute('href','/connect#mcp');
 await page.getByText('What is stored?',{exact:true}).click();const privacy=page.locator('.welcome-privacy');await expect(privacy).toContainText('encrypted API keys');await expect(privacy).toContainText('browser');await expect(privacy).toContainText('official CLI');
 for(const link of await page.locator('.welcome-primary').all()){
  const ratio=()=>link.evaluate(el=>{const style=getComputedStyle(el),lum=(value:string)=>{const c=value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>{const v=n/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return c[0]*.2126+c[1]*.7152+c[2]*.0722};const a=lum(style.color),b=lum(style.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
  expect(await ratio()).toBeGreaterThanOrEqual(4.5);await link.hover();await expect.poll(ratio).toBeGreaterThanOrEqual(4.5);
 }

});
test('entering the studio preserves local drafts and makes returning visits skip the intro',async({page,context})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('welcome-continuity-fixture','keep'));await page.getByRole('link',{name:'Start creating free',exact:true}).click();await expect(page).toHaveURL(/\/studio/);await expect(page.getByLabel('Prompt',{exact:true})).toBeVisible();await expect.poll(async()=>(await context.cookies()).some(c=>c.name==='openpikzels-entry'&&c.value==='studio')).toBe(true);expect(await page.evaluate(()=>localStorage.getItem('welcome-continuity-fixture'))).toBe('keep');
 await page.getByLabel('Prompt',{exact:true}).fill('The draft survives the new introduction');await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('heading',{name:'Concept saved.',exact:true})).toBeVisible();await page.goto('/');await expect(page).toHaveURL(/\/studio/);await expect(page.getByLabel('Prompt',{exact:true})).toHaveValue('The draft survives the new introduction');
 const response=await page.request.get('/?mode=edit&origin=legacy',{maxRedirects:0});expect(response.status()).toBe(307);expect(response.headers().location).toBe('/studio?mode=edit&origin=legacy');await page.goto('/welcome');await expect(page.getByRole('heading',{level:1,name:'GET MILLIONS OF VIEWS',exact:true})).toBeVisible();
});
test('welcome reflows, exposes immediate keyboard access and keeps reduced motion static',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});await page.goto('/welcome');await expect(page.getByRole('heading',{level:1,name:'GET MILLIONS OF VIEWS',exact:true})).toBeVisible();await page.locator('.welcome-art img').evaluate(i=>(i as HTMLImageElement).decode());expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await expect(page.locator('.welcome-art source')).toHaveCount(0);await expect(page.locator('.welcome-headline')).toHaveCSS('animation-name','none');await page.screenshot({path:'evidence/welcome-'+width+'.png',fullPage:true});}const open=page.getByRole('link',{name:'Start creating free',exact:true});await open.focus();await expect(open).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByLabel('Prompt',{exact:true})).toBeVisible();
});

test('fresh legacy links preserve duplicate query values without relying on a studio cookie',async({request})=>{
 const response=await request.get('/?mode=edit&tag=first&tag=second&next=https%3A%2F%2Fexample.com',{maxRedirects:0});expect(response.status()).toBe(307);expect(response.headers().location).toBe('/studio?mode=edit&tag=first&tag=second&next=https%3A%2F%2Fexample.com');
 const invalid=await request.get('/?mode=unknown',{maxRedirects:0});expect(invalid.status()).toBe(200);expect(await invalid.text()).toContain('GET MILLIONS');
});

test('ChatGPT onboarding requires no download and requires app sign-in before provider authorization',async({page})=>{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto('/welcome');
  await expect(page.locator('a[href="/local-companion"]')).toHaveCount(0);
  await page.getByRole('link',{name:'Connect my ChatGPT plan',exact:true}).click();
  await expect(page).toHaveURL(/\/connect#chatgpt$/);
  const panel=page.getByRole('region',{name:'Connect your ChatGPT plan'});
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Sign in to OpenPikzels below');
  await expect(panel).toContainText('No download required.');
  await expect(page.getByRole('link',{name:/download|set up local companion/i})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Continue with ChatGPT',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:'evidence/chatgpt-browser-'+width+'.png',fullPage:true});
 }
});
