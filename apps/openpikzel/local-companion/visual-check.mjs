import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createCompanion} from './server.mjs';
const server=await createCompanion({port:0,runner:{inspect:async()=>({installed:true,authenticated:true,method:'Fixture status — no real account'}),run:async()=> 'Fixture output — no model called.\n<script>window.untrustedExecuted=true</script>\n1. A truthful video title\n2. A distinct video title'}});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 await page.goto(server.launchUrl());
 await page.getByLabel('Local agent',{exact:true}).selectOption('codex');
 await page.getByLabel('Video brief and constraints',{exact:true}).fill('A real experiment comparing two thumbnail layouts. Preserve the actual video promise.');
 await page.getByRole('button',{name:'Run this text task',exact:true}).click();
 await page.getByText('Text task complete. No image API was called.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.untrustedExecuted),undefined);
 await page.screenshot({path:'evidence/local-companion-ui-1280.png',fullPage:true});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width);
  await page.screenshot({path:'evidence/local-companion-ui-'+width+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Refresh sign-in status',exact:true}).focus();
 assert.equal(await page.getByRole('button',{name:'Refresh sign-in status',exact:true}).evaluate(el=>el===document.activeElement),true);
 console.log('Local companion browser checks passed: real loopback UI, literal markup, keyboard focus, desktop and 320/390 mobile. Fixtures only.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
