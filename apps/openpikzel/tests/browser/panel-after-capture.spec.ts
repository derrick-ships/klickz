import {test,expect} from "@playwright/test";
import {reviewFixture} from "./helpers/review-fixture";
test("capture local panel final",async({page})=>{
 await page.route("**/*",r=>(new URL(r.request().url()).hostname==="127.0.0.1"||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
 await page.route("**/api/config",r=>r.fulfill({json:{cloud:true,ai:true,openai:false,google:false,jev:false,ownerGate:false,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test",secureConnections:true,codexDevice:true,mcpUrl:"http://127.0.0.1:3000/mcp"}}));
 await page.setViewportSize({width:1440,height:900});await page.goto("/welcome");await page.screenshot({path:"evidence/panel-after-01-welcome.png",fullPage:true});
 await page.goto("/studio");await expect(page.getByLabel("Prompt",{exact:true})).toBeVisible();await page.screenshot({path:"evidence/panel-after-02-studio.png",fullPage:true});
 await page.getByLabel("Prompt",{exact:true}).fill("A scientist holds a tiny sun above a city, title SMALL STAR");await page.screenshot({path:"evidence/panel-after-03-brief.png",fullPage:true});
 await page.reload();await page.screenshot({path:"evidence/panel-after-04-reloaded.png",fullPage:true});
 await page.evaluate(()=>localStorage.clear());
 await reviewFixture(page,false);await page.setViewportSize({width:1100,height:900});await page.screenshot({path:"evidence/panel-after-05-review.png",fullPage:true});
 await page.getByRole("region",{name:"Thumbnail review studio"}).getByRole("button",{name:"Edit",exact:true}).click();await page.getByLabel("Edits",{exact:true}).fill("Make the headline white and keep the original red subject");await page.getByRole("button",{name:"Save draft",exact:true}).click();await page.screenshot({path:"evidence/panel-after-06-edit-draft.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto("/connect");await page.screenshot({path:"evidence/panel-after-07-connect-mobile.png",fullPage:true});
 await page.goto("/studio?mode=generate");await page.screenshot({path:"evidence/panel-after-08-studio-mobile.png",fullPage:true});
});
