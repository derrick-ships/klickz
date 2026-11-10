import {it,expect,vi,afterEach} from "vitest";
import sharp from "sharp";
import {providerContext} from "../src/lib/provider-context";
import {requireAI} from "../src/lib/server";
import {suggestTitles,observePackaging,prepareIdentity,evaluateThumbnail} from "../src/lib/providers";
import {ideaSchema,reviewSchema} from "../src/lib/validation";
import {generationReadiness} from "../src/lib/generation-readiness";
import {defaultSettings,pillars} from "../src/lib/types";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const image=()=>sharp({create:{width:640,height:360,channels:3,background:"red"}}).png().toBuffer();
const observations={summary:"Visible subject",dimensions:Object.fromEntries(pillars.map(p=>[p,{observation:"Visible subject",strength:"Clear focal point",weakness:"Competing text",fix:"Reduce competing text"}]))};
const google=(value:unknown)=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:typeof value==="string"?value:JSON.stringify(value)}]}}]}),{headers:{"content-type":"application/json"}});
it("requires the selected provider even when another key is connected",async()=>providerContext.run({google:"fixture",jev:"fixture"},async()=>{
 vi.stubEnv("AI_ENABLED","true");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 expect(()=>requireAI("openai")).toThrow(/OpenAI API key/);
 await expect(suggestTitles("A factual video idea","Viewers")).rejects.toThrow(/OpenAI API key/);
 await expect(observePackaging(await image(),"A factual title")).rejects.toThrow(/OpenAI API key/);
 await expect(prepareIdentity([await image()],"Label","style")).rejects.toThrow(/OpenAI API key/);
 await expect(evaluateThumbnail(await image(),"A title","request",{videoBrief:"",audience:"",includeVision:true})).rejects.toThrow(/OpenAI API key/);
 expect(fetcher).not.toHaveBeenCalled();
}));
it("honors explicit Google choice with both keys and records the actual image reviewer",async()=>providerContext.run({openai:"fixture",google:"fixture",jev:"fixture"},async()=>{
 const titles=["One","Two","Three","Four","Five"],calls:unknown[][]=[];
 const fetcher=vi.fn(async(...args:unknown[])=>{calls.push(args);return String(args[0]).includes("typesafe.ai")?new Response(JSON.stringify({answers:Object.fromEntries(pillars.map(p=>[p,{score:2,confidence:.8}]))})):google(calls.length===1?{titles}:calls.length===2?"Reference-guided style":observations);});vi.stubGlobal("fetch",fetcher);
 expect(await suggestTitles("A factual video idea","Viewers","google")).toEqual(titles);
 expect(await prepareIdentity([await image()],"Label","style","google")).toContain("Reference-guided");
 const score=await evaluateThumbnail(await image(),"A title","request",{videoBrief:"",audience:"",includeVision:true,critiqueProvider:"google"});
 expect(calls).toHaveLength(4);expect(calls.slice(0,3).every(c=>String(c[0]).includes("generativelanguage.googleapis.com"))).toBe(true);
 expect(score.contributors?.map(c=>c.provider)).toEqual(["Jev","Google API"]);
}));
it("validates provider choice and defaults older requests to OpenAI without fallback",()=>{
 expect(ideaSchema.parse({prompt:"An actual video idea"}).provider).toBe("openai");
 expect(ideaSchema.parse({prompt:"An actual video idea",provider:"google"}).provider).toBe("google");
 expect(reviewSchema.parse({imagePath:"user/source.png",critiqueProvider:"google"}).critiqueProvider).toBe("google");
 expect(()=>ideaSchema.parse({prompt:"An actual video idea",provider:"subscription"})).toThrow();
});
it("blocks an unavailable selected text role and offers Google only after an explicit choice",()=>{
 const config={cloud:true,ai:true,openai:false,google:true,jev:true,anthropic:false,supabaseUrl:"",supabaseKey:"",ownerGate:false,textModels:{openai:"OpenAI model",google:"Google model"}};
 const input={config,cloud:true,loading:false,tool:"title",titleIdeas:true,settings:defaultSettings,prompt:"An actual video idea",title:"",hasSource:false,hasReferences:false,includeVision:false};
 expect(generationReadiness(input).action).toBe("connect");
 expect(generationReadiness({...input,textProvider:"google"}).identity).toBe("Google · Google model");
 expect(generationReadiness({...input,textProvider:"google"}).action).toBe("run");
});
