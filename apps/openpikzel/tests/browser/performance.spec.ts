import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("controlled mobile lab budgets and immediate feedback @performance", async ({ browser }, testInfo) => {
  test.setTimeout(90000);
  const samples: Record<string,number>[]=[];
  for(let run=0;run<3;run++) {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:1_600_000/8,uploadThroughput:750_000/8});
    const errors: string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    const collect = () => {
      const w=window as any; w.__labVitals={};
      for(const [method,key] of [["onLCP","lcp"],["onCLS","cls"],["onINP","inp"]])
        w.webVitals[method]((m:any)=>{w.__labVitals[key]=m.value;},{reportAllChanges:true,durationThreshold:16});
    };
    // One init script guarantees library-before-collector ordering.
    await page.addInitScript({content:await readFile("node_modules/web-vitals/dist/web-vitals.iife.js","utf8")+"\nwindow.webVitals=webVitals;\n("+collect.toString()+")();"});
    await page.goto("/?mode=generate");
    await page.waitForLoadState("networkidle");
    const first=await page.evaluate(() => {
      const resources=performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const size=(suffix:string)=>resources.filter(r=>new URL(r.name).pathname.endsWith(suffix)).reduce((n,r)=>n+r.encodedBodySize,0);
      return {script_bytes:size(".js"),css_bytes:size(".css"),image_bytes:resources.filter(r=>r.initiatorType==="img"||/\.(webp|png)$/.test(r.name)).reduce((n,r)=>n+r.encodedBodySize,0),total_bytes:nav.encodedBodySize+resources.reduce((n,r)=>n+r.encodedBodySize,0),third_party:resources.filter(r=>new URL(r.name).origin!==location.origin).length};
    });
    const feedback:number[]=[];
    for(const name of ["Score","Edit","Create"]) {
      await page.getByRole("tab",{name,exact:true}).evaluate(el=>el.addEventListener("click",()=>{
        const w=window as any,start=performance.now();
        requestAnimationFrame(()=>requestAnimationFrame(()=>{w.__feedback=performance.now()-start;}));
      },{once:true,capture:true}));
      await page.evaluate(()=>{(window as any).__feedback=null;});
      await page.getByRole("tab",{name,exact:true}).click();
      await page.waitForFunction(()=>typeof (window as any).__feedback==="number");
      feedback.push(await page.evaluate(()=>(window as any).__feedback));
    }
    await expect.poll(()=>page.evaluate(()=>typeof (window as any).__labVitals.inp)).toBe("number");
    const vitals=await page.evaluate(()=>(window as any).__labVitals);
    expect(typeof vitals.lcp).toBe("number");expect(typeof vitals.cls).toBe("number");
    const sample={...first,lcp_ms:vitals.lcp,cls:vitals.cls,inp_sample_ms:vitals.inp,feedback_max_ms:Math.max(...feedback)};
    samples.push(sample);
    expect(errors).toEqual([]);
    await context.close();
  }
  const report={method:{build:"production",browser:"Chromium",viewport:"390x844",cpuSlowdown:4,latencyMS:150,downloadMbps:1.6,uploadMbps:.75,runs:3,note:"scripted lab samples, not real-user p75 or a production SLA"},samples};
  await writeFile("evidence/performance-lab.json",JSON.stringify(report,null,2));
  await testInfo.attach("lab measurements",{body:JSON.stringify(report,null,2),contentType:"application/json"});
  console.log(JSON.stringify(report));
  for(const sample of samples){expect(sample.script_bytes).toBeGreaterThan(50000);expect(sample.feedback_max_ms).toBeLessThanOrEqual(100);}
});
