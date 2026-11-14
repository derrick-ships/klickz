import {test,expect,type Page} from "@playwright/test";
import { openMoreOptions } from "./helpers/more-options";
import {writeFile} from "node:fs/promises";
import {reviewFixture} from "./helpers/review-fixture";
test("LOOP provisional automated accessibility matrix",async({page})=>{
 test.setTimeout(120000);
 await page.route("**/*",r=>(new URL(r.request().url()).hostname==="127.0.0.1"||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 const reports:any[]=[];
 async function scan(state:string){
  await page.addScriptTag({path:"node_modules/axe-core/axe.min.js"});
  const result=await page.evaluate(async()=>{const r=await (window as any).axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa"]}});return {violations:r.violations.map((v:any)=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length};});
  reports.push({state,width:page.viewportSize()!.width,...result});
 }
 for(const width of [320,390,768,1024,1100,1440,1920]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/welcome");await scan("welcome ready");expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.goto("/studio");await expect(page.getByLabel("Describe your thumbnail",{exact:true})).toBeVisible();await scan("studio blank");expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.setViewportSize({width:390,height:844});
 await openMoreOptions(page);await page.getByRole("button",{name:/^Rendering model:/}).click();await scan("model picker");await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:/^Rendering model:/})).toBeFocused();
 await page.getByRole("button",{name:"Connections",exact:true}).click();await scan("connections modal");await page.keyboard.press("Escape");
 await page.getByRole("button",{name:"Sign in to generate",exact:true}).click();await scan("sign-in modal");await page.keyboard.press("Escape");
 await page.route("**/api/config",r=>r.fulfill({json:{cloud:true,ai:true,openai:false,google:false,jev:false,ownerGate:false,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test",secureConnections:true,codexDevice:true}}));
 await page.goto("/connect");await expect(page.getByRole("heading",{name:"Sign in to OpenPikzels",exact:true})).toBeVisible();await scan("connection page signed out");
 await page.goto("/local-companion");await scan("local companion");
 await page.evaluate(()=>localStorage.clear());await reviewFixture(page,true);await scan("partial analysis");await page.getByRole("region",{name:"Thumbnail review studio"}).getByRole("button",{name:"Edit",exact:true}).click();await scan("selected image edit");
 await writeFile("evidence/loop-axe.json",JSON.stringify({method:"Automated axe WCAG A/AA checks on local fixtures; incomplete findings need manual review; not a screen-reader test.",reports},null,2));
 console.log(JSON.stringify(reports.map(r=>({state:r.state,width:r.width,violations:r.violations.map((v:any)=>v.id),incomplete:r.incomplete.length}))));
 expect(reports.flatMap(r=>r.violations.map((v:any)=>({state:r.state,width:r.width,...v})))).toEqual([]);
});
