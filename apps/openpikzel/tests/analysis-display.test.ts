import {describe,it,expect,vi,afterEach} from "vitest";
import {scanCounter,recomposePrompt} from "../src/lib/analysis-display";
import {youtubeVideoId,readVideoEvidence} from "../src/lib/video-context";
import {enrichDiagnostic} from "../src/lib/diagnostics";
import {parseScores} from "../src/lib/validation";
import {pillars} from "../src/lib/types";
afterEach(()=>vi.unstubAllGlobals());
describe("honest analysis and recomposition",()=>{
 it("cannot imply completion while running or failed, including long waits",()=>{
  expect(scanCounter(0,"running")).toBe(0);
  for(const t of [100,5000,60000,900000]){expect(scanCounter(t,"running")).toBeLessThan(100);expect(scanCounter(t,"failed")).toBeLessThan(100);}
  expect(scanCounter(1,"succeeded")).toBe(100);
  expect(scanCounter(50000,"running",true)).toBe(0);
 });
 it("directs a new composition with preservation rather than padding",()=>{
  expect(recomposePrompt("short")).toContain("vertical 9:16");
  expect(recomposePrompt("long")).toContain("horizontal 16:9");
  expect(recomposePrompt("short")).toContain("exact readable headline");
  expect(recomposePrompt("short")).toContain("Do not merely crop");
 });
 it("accepts only official video IDs and never follows arbitrary URLs",()=>{
  expect(youtubeVideoId("https://youtu.be/abcdefghijk?t=2")).toBe("abcdefghijk");
  expect(youtubeVideoId("https://www.youtube.com/shorts/abcdefghijk")).toBe("abcdefghijk");
  for(const u of ["http://youtube.com/watch?v=abcdefghijk","https://evil.test/watch?v=abcdefghijk","https://youtube.com@evil.test/watch?v=abcdefghijk","https://youtube.com:444/watch?v=abcdefghijk","https://youtube.com/channel/abc"]){expect(()=>youtubeVideoId(u)).toThrow();}
 });
 it("retrieves metadata without calling it a watched video, and handles missing access",async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({items:[{snippet:{title:"Real title",description:"Public description"}}]})));
  vi.stubGlobal("fetch",fetcher);
  const missing=await readVideoEvidence("https://youtu.be/abcdefghijk");
  expect(missing.kind).toBe("unavailable");expect(fetcher).not.toHaveBeenCalled();
  const result=await readVideoEvidence("https://youtu.be/abcdefghijk","fixture-key");
  expect(result.title).toBe("Real title");expect(result.notice).toContain("not a transcript");
  expect(String(fetcher.mock.calls[0][0])).toContain("https://www.googleapis.com/youtube/v3/videos");
  fetcher.mockRejectedValueOnce(new Error("private detail"));
  const failed=await readVideoEvidence("https://youtu.be/abcdefghijk","fixture-key");
  expect(failed.kind).toBe("unavailable");expect(failed.notice).not.toContain("private detail");
 });
 it("assesses the title/image concept without demanding a written brief, preserving missing scores",()=>{
  const raw=parseScores({answers:Object.fromEntries(pillars.map(p=>[p,{score:2,confidence:.7}]))});
  const full=enrichDiagnostic(raw,Buffer.from("fixture"),"An actual video title",{videoBrief:"",audience:"",includeVision:false},{width:200,height:113,digest:"fixture"},false);
  expect(full.overall).toBe(67);expect(full.dimensions.idea.score).toBe(67);expect(full.warnings?.join(" ")).toContain("not watched");expect(full.fixBlocked).toBe(true);
  raw.dimensions.curiosity.score=null;
  const partial=enrichDiagnostic(raw,Buffer.from("fixture"),"Title",{videoBrief:"",audience:"",includeVision:false},{width:200,height:113,digest:"fixture"},false);
  expect(partial.overall).toBeNull();expect(partial.dimensions.curiosity.score).toBeNull();
 });
});
