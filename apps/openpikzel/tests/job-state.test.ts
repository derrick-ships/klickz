import {it,expect} from "vitest";
import {jobGuidance,jobStates,jobOperationLabel,uncertainJobAdvice} from "../src/lib/job-state";
it("makes every durable job state safe and actionable for UI and MCP",()=>{
 for(const state of jobStates){expect(jobGuidance(state).automaticRetryAllowed).toBe(false);expect(jobGuidance(state).message.length).toBeGreaterThan(30);}
 expect(jobGuidance("running").nextAction).toBe("wait");
 expect(jobGuidance("succeeded").nextAction).toBe("use_result");
 expect(jobGuidance("reconciling").nextAction).toBe("inspect_provider_history");
 expect(jobGuidance("failed").message).toContain("saved images");
});
it("labels activity and explains uncertain requests",()=>{
 expect(jobOperationLabel("generate")).toBe("Create");
 expect(jobOperationLabel("analyze")).toBe("Score");
 expect(uncertainJobAdvice).toContain("never retries automatically");
});
it("treats unknown or malformed states as uncertain, never retryable",()=>{
 for(const value of [null,undefined,"toString","__proto__","future",{},100])expect(jobGuidance(value)).toMatchObject({nextAction:"inspect_before_new_request",automaticRetryAllowed:false});
});
