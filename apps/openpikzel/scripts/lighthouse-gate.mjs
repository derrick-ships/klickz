import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
const fallback="/home/agent/.cache/ms-playwright/chromium_headless_shell-1161/chrome-linux/headless_shell";
const chrome=process.env.CHROME_PATH || (existsSync(fallback) ? fallback : undefined);
let failed=false;
const summary=[];
for(const profile of ["mobile","desktop"]) {
  console.log(`\nThree-run ${profile} Lighthouse gate (production build)`);
  rmSync(`evidence/lighthouse/${profile}`, {recursive:true, force:true});
  const run=spawnSync("node_modules/.bin/lhci",["autorun","--config=./lighthouserc.cjs"],{
    stdio:"inherit",env:{...process.env,LHCI_PROFILE:profile,...(chrome?{CHROME_PATH:chrome}:{})}
  });
  if(run.status!==0)failed=true;
  const directory=`evidence/lighthouse/${profile}`;
  if(existsSync(`${directory}/manifest.json`)) {
    const manifest=JSON.parse(readFileSync(`${directory}/manifest.json`,"utf8"));
    const runs=manifest.map(item=>{
      const report=JSON.parse(readFileSync(item.jsonPath,"utf8"));
      return {representative:item.isRepresentativeRun,lighthouseVersion:report.lighthouseVersion,
        browser:report.environment.hostUserAgent,scores:item.summary,
        lcp_ms:report.audits["largest-contentful-paint"].numericValue,
        tbt_ms:report.audits["total-blocking-time"].numericValue,
        cls:report.audits["cumulative-layout-shift"].numericValue,
        resources:report.audits["resource-summary"].details.items};
    });
    summary.push({profile,pass:run.status===0,runs});
  }
}
writeFileSync("evidence/performance-lighthouse-summary.json",JSON.stringify({method:"production build; three runs per profile, median-run assertions; not field p75",profiles:summary},null,2));
process.exitCode=failed?1:0;
