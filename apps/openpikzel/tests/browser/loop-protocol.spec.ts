import {test,expect,type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test('LOOP v2 page routes, required breakpoints, links and runtime errors',async({page,request})=>{
 test.setTimeout(180000);
 const reports:any[]=[],external=new Set<string>(),errors:string[]=[],failed:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')failed.push(new URL(r.url()).pathname);});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1'||['blob:','data:'].includes(u.protocol))return r.continue();external.add(u.origin);return r.abort();});
 await page.route('**/api/config',r=>r.fulfill({json:{cloud:false,ai:false,openai:false,jev:false,google:false}}));
 await page.route('**/api/oauth/consent?*',r=>r.fulfill({json:{name:'Fixture agent',redirect:'http://127.0.0.1:4321/callback',scope:['studio:read','studio:write']}}));
 const routes=['/','/welcome','/studio','/connect','/local-companion','/oauth/consent?request=fixture'];
 const checkedLinks=new Map<string,number>();
 for(const width of [320,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
  for(const route of routes){
   errors.length=0;failed.length=0;const consoleErrors:string[]=[];
   const collect=(message:any)=>{if(message.type()==='error')consoleErrors.push(message.text());};page.on('console',collect);
   const response=await page.goto(route);await expect(page.locator('h1').first()).toBeVisible();
   if(route==='/studio')await expect(page.getByLabel('Describe your thumbnail',{exact:true})).toBeVisible();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>({label:a.textContent?.trim(),href:(a as HTMLAnchorElement).href})));
   for(const link of links){const u=new URL(link.href);if(u.origin!==new URL(page.url()).origin)continue;
    if(['/','/welcome','/studio','/connect','/local-companion','/oauth/consent'].includes(u.pathname)&&!checkedLinks.has(u.pathname)){const result=await request.get(u.pathname);checkedLinks.set(u.pathname,result.status());}
   }
   const key=(route.split('?')[0].slice(1)||'root').replaceAll('/','-');await page.screenshot({path:'evidence/loop-v2-'+key+'-'+width+'.png',fullPage:true});
   page.off('console',collect);reports.push({route,state:'ready, local signed-out configuration',width,status:response?.status(),overflow,pageErrors:[...errors],consoleErrors,failedRequests:[...failed],links});
  }
 }
 const result={method:'Local production build, signed-out/local configuration, reduced motion. External links are inventoried, not contacted. Ready page states only; not all authenticated/loading/error states.',reports,internalPageLinks:[...checkedLinks].map(([route,status])=>({route,status})),blockedExternalOrigins:[...external]};
 await writeFile('evidence/loop-v2-route-checks.json',JSON.stringify(result,null,2));
 expect(reports.filter(r=>r.status!==200||r.overflow||r.pageErrors.length||r.consoleErrors.length||r.failedRequests.length)).toEqual([]);
 expect([...checkedLinks.values()].every(status=>status===200)).toBe(true);expect([...external]).toEqual([]);
});
test('LOOP v2 account loading, setup failure and invalid form recovery',async({page})=>{
 await page.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||['blob:','data:'].includes(u.protocol)?r.continue():r.abort();});
 await page.setViewportSize({width:1024,height:900});
 let release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/config',async r=>{await hold;return r.fulfill({json:{cloud:false,ai:false,openai:false,jev:false,google:false}});});
 await page.goto('/connect');await expect(page.getByText('Loading your connections…',{exact:true})).toBeVisible();await page.screenshot({path:'evidence/loop-v2-account-loading-1024.png',fullPage:true});release();
 await expect(page.getByText('Loading your connections…',{exact:true})).toHaveCount(0);
 await page.unroute('**/api/config');await page.route('**/api/config',r=>r.abort('failed'));
 await page.reload();await expect(page.getByText('Could not load your account. Refresh this page to try again.',{exact:true})).toBeVisible();await page.screenshot({path:'evidence/loop-v2-account-error-1024.png',fullPage:true});
 await page.unroute('**/api/config');await page.route('**/api/config',r=>r.fulfill({json:{cloud:true,ai:false,openai:false,jev:false,google:false,supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test'}}));
 let authCalls=0;await page.route('https://test.supabase.co/**',r=>{authCalls++;return r.abort();});
 await page.reload();const email=page.getByLabel('Email',{exact:true});await email.fill('invalid-address');await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).click();
 expect(await email.evaluate((e:HTMLInputElement)=>e.validity.typeMismatch)).toBe(true);expect(authCalls).toBe(0);await expect(email).toBeFocused();await email.fill('creator@example.test');expect(await email.evaluate((e:HTMLInputElement)=>e.validity.valid)).toBe(true);
 await writeFile('evidence/loop-v2-form-checks.json',JSON.stringify({route:'/connect',width:1024,states:['loading displayed','configuration failure displayed','recovery by reload','invalid email prevents submission','corrected email accepted by browser validation'],authCalls,providerSignInTested:false},null,2));
});
