import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Engine} from './engine.mjs';import {createCompanion} from './server.mjs';
const dir=await mkdtemp(join(tmpdir(),'op-cards-browser-')),engine=new Engine(dir),server=await createCompanion({port:0,engine,runner:{inspect:async()=>({installed:true,authenticated:true,method:'Fixture account'})},readTelemetry:async()=>({windows:[{kind:'session',usedPercent:25}],capturedAt:Date.now(),models:[{id:'fixture-model',name:'Fixture model',efforts:['low','high']}],gate:{allowed:true}})}),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});await page.goto(server.launchUrl());await page.getByText('25% used',{exact:false}).waitFor();
 await page.getByLabel('Model',{exact:true}).selectOption('fixture-model');await page.getByLabel('Reasoning effort',{exact:true}).selectOption('high');
 await page.getByText('Connect tools and manage private keys',{exact:true}).click();await page.getByLabel('Key name',{exact:true}).fill('TEST_KEY');await page.getByRole('button',{name:'Open private key box',exact:true}).click();
 const password=page.getByPlaceholder('Leave empty to keep current key',{exact:true});assert.equal(await password.getAttribute('type'),'password');await password.fill('fixture-only-value');await page.getByRole('button',{name:'Save private keys',exact:true}).click();await page.getByText('Private key status saved. Values are not shown.',{exact:true}).waitFor();
 assert.equal((await engine.env('default')).TEST_KEY,'fixture-only-value');assert.equal(JSON.stringify(await engine.read('default')).includes('fixture-only-value'),false);assert.equal(await page.locator('body').innerText().then(x=>x.includes('fixture-only-value')),false);
 await engine.card('default','ask_user',{questions:[{question:'Which concept should we develop?',options:['Clear subject','Stronger curiosity'],header:null}]});
 await page.getByRole('button',{name:'Refresh sign-in status',exact:true}).click();await page.getByLabel('Which concept should we develop?',{exact:true}).selectOption('Clear subject');await page.getByRole('button',{name:'Submit response',exact:true}).click();await page.getByText('Response saved. Run the task again to continue.',{exact:true}).waitFor();
 assert.equal((await engine.snapshot('default')).pending,null);
 await engine.card('default','request_approval',{approvals:[{action:'Score the selected thumbnail',detail:'Fixture action. No provider will be called.'}]},{operation:{server:'studio',tool:'score_thumbnail',args:{title:'A truthful video promise'}},operationHash:'fixture'});
 await page.getByRole('button',{name:'Refresh sign-in status',exact:true}).click();await page.getByRole('button',{name:'Allow once',exact:true}).waitFor();await page.screenshot({path:'evidence/companion-cards-1280.png',fullPage:true});
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width);await page.screenshot({path:'evidence/companion-cards-'+width+'.png',fullPage:true});await page.locator('#pending-card').screenshot({path:'evidence/companion-card-detail-'+width+'.png'});}
 await page.getByRole('button',{name:'Deny',exact:true}).click();await page.getByText('Response saved. Run the task again to continue.',{exact:true}).waitFor();assert.equal((await engine.snapshot('default')).pending,null);
 console.log('Cards browser: masked key save, transcript privacy, catalog/effort, question reply, approval denial, reduced motion and1280/320/390 reflow passed. Fixtures only.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await engine.close();await rm(dir,{recursive:true,force:true});}
