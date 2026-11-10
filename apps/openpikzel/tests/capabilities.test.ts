import {afterEach,it,expect,vi} from "vitest";
import {providerCapabilities} from "../src/lib/capabilities";
afterEach(()=>vi.unstubAllEnvs());
it("reports saved connections without asserting entitlement or allowing provider fallback",()=>{const result=providerCapabilities({ai:true,openai:false,google:true,jev:false});expect(result.modelAccessVerified).toBe(false);expect(result.fallbackAllowed).toBe(false);expect(result.images.find(model=>model.id==="flare")?.connectionSaved).toBe(false);expect(result.images.find(model=>model.id==="gemini-flash")?.connectionSaved).toBe(true);expect(result.textRoles.titles.map(role=>role.provider)).toEqual(["openai","google"]);});
it("declares provider request limits and the app's actual partial capabilities",()=>{const result=providerCapabilities({ai:true,openai:true,google:true,jev:true});expect(result.images.find(model=>model.id==="gemini-pro")?.maxReferenceImages).toBe(14);expect(result.images.find(model=>model.id==="flare")?.maxReferenceImages).toBe(16);expect(result.video.fullVideoAnalysis).toBe(false);expect(result.subscriptionChat).toBe(false);expect(result.jobs.detachedWorker).toBe(false);expect(result.jobs.automaticPaidRetry).toBe(false);expect(result.automaticReview.requiresOptIn).toBe(true);});
it("shows the ANTHROPIC_VISION_MODEL override on image review",()=>{
 vi.stubEnv("ANTHROPIC_VISION_MODEL","claude-opus-test-override");
 const result=providerCapabilities({ai:true,openai:false,google:false,jev:false,anthropic:true});
 expect(result.textRoles.imageReview.find(role=>role.provider==="anthropic")?.model).toBe("claude-opus-test-override");
});
