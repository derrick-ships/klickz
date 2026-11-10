import {describe,expect,it} from "vitest";
import {FIX_PLAN_NOTICE,GEMINI_FIX_NOTICE} from "../src/lib/fix-plan-notice";

describe("fix-plan notice",()=>{
 it("promises a new score and does not say there is no automatic re-analysis",()=>{
  expect(FIX_PLAN_NOTICE).toBe("One new image-provider request, then a new score. Provider cost depends on your own account; no price estimate or guaranteed fidelity is claimed.");
  expect(FIX_PLAN_NOTICE).not.toMatch(/No automatic re-analysis/i);
  expect(FIX_PLAN_NOTICE).not.toMatch(/\$\d/);
 });
 it("uses the exact Gemini Q8 warning",()=>{
  expect(GEMINI_FIX_NOTICE).toBe("Gemini may change more of the image than an OpenAI edit.");
 });
});
