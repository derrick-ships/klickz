import {describe,it,expect} from "vitest";
import {canApplyEdit,generationReadiness} from "../src/lib/generation-readiness";
import {defaultSettings,type Config} from "../src/lib/types";
import {imageModel} from "../src/lib/image-models";
const config:Config={cloud:true,ai:true,openai:true,jev:true,anthropic:false,google:false,supabaseUrl:"",supabaseKey:"",ownerGate:false,textModels:{openai:"configured-openai-text",google:"configured-google-text"},scoreModel:"configured-jev"};
const base={config,cloud:true,loading:false,tool:"generate",titleIdeas:false,settings:defaultSettings,prompt:"A clear visual idea",title:"",hasSource:false,hasReferences:false,includeVision:false};
describe("request readiness",()=>{
 it("requires a distinct edit instruction",()=>{expect(canApplyEdit("  ","original")).toBe(false);expect(canApplyEdit(" original ","original")).toBe(false);expect(canApplyEdit("brighten the face","original")).toBe(true);});
 it("does not treat any connected image provider as the selected provider",()=>{expect(generationReadiness({...base,settings:{...defaultSettings,model:"gemini-pro"}}).readiness).toContain("Connect your Google");expect(generationReadiness({...base,config:{...config,openai:false,google:true}}).readiness).toContain("Connect your OpenAI");});
 it("shows actual mappings and explicitly unknown spend",()=>{const r=generationReadiness({...base,settings:{...defaultSettings,batch:4,format:"short"}});expect(r.apiModel).toContain(imageModel("flare").apiModel);expect(r.quantity).toBe("4 images · 9:16");expect(r.cost).toContain("total remains unknown");expect(r.readiness).toContain("Connection saved");});
 it("explains sign-in, disabled AI, missing source and incomplete prompt",()=>{expect(generationReadiness({...base,cloud:false}).readiness).toContain("Sign in");expect(generationReadiness({...base,config:{...config,ai:false}}).readiness).toContain("not enabled");expect(generationReadiness({...base,tool:"edit"}).readiness).toContain("Choose an image");expect(generationReadiness({...base,tool:"recreate"}).readiness).toContain("reference");expect(generationReadiness({...base,prompt:""}).readiness).toContain("8 characters minimum");});
 it("honors explicit text selection and explains optional vision dependency",()=>{const r=generationReadiness({...base,tool:"title",titleIdeas:true,textProvider:"google",config:{...config,openai:false,google:true}});expect(r.identity).toBe("Google · configured-google-text");expect(r.quantity).toBe("Five title ideas");expect(generationReadiness({...base,tool:"analyze",hasSource:true,includeVision:true,config:{...config,openai:false,google:false}}).readiness).toContain("extra image review");});
});

it("requires raw input in title-image mode",()=>{expect(generationReadiness({...base,tool:"title",prompt:"  ",title:" "}).readiness).toBe("Add a video title or direction before generating.");expect(generationReadiness({...base,tool:"title",prompt:"",title:"AI"}).readiness).toContain("Connection saved");});

it("shows verified output-only estimates with input and analysis charges left explicit",()=>{for(const [quality,want] of [["low","$0.015"],["medium","$0.028"],["high","$0.032"],["xhigh","$0.058"],["max","$0.129"]] as const){const r=generationReadiness({...base,settings:{...defaultSettings,quality,batch:1}});expect(r.cost).toContain(want);expect(r.cost).toContain("image output");expect(r.cost).toContain("total remains unknown");}const four=generationReadiness({...base,settings:{...defaultSettings,quality:"medium",batch:4,format:"short"}});expect(four.cost).toContain("$0.111");const google=generationReadiness({...base,settings:{...defaultSettings,model:"gemini-flash",batch:1}});expect(google.cost).toContain("$0.067");});

it("does not block image generate when Jev or a vision key is missing",()=>{expect(generationReadiness({...base,config:{...config,jev:false}})).toMatchObject({action:"run"});expect(generationReadiness({...base,includeVision:true,textProvider:"google",config:{...config,google:false}})).toMatchObject({action:"run"});});

it("treats failed provider lookup as unknown instead of claiming a key is disconnected",()=>{const value=generationReadiness({...base,config:{...config,connectionStatus:"failed"}});expect(value).toMatchObject({action:"retry",connectionCheckFailed:true});expect(value.readiness).toContain("Connection status could not load");});

it("gives the generate button a short image cost and a spoken description, only for image requests",()=>{
 const r=generationReadiness({...base,settings:{...defaultSettings,quality:"medium",batch:1}});
 expect(r.costShort).toBe("~$0.03 + score");
 expect(r.costDescription).toBe("Estimated image output about $0.03 for 1 image, plus a score. Inputs and any analysis are extra.");
 const four=generationReadiness({...base,settings:{...defaultSettings,quality:"medium",batch:4,format:"short"}});
 expect(four.costShort).toBe("~$0.12 + score");expect(four.costDescription).toContain("for 4 images");
 expect(four.costDescription).toContain("plus a score");
 const withoutJev=generationReadiness({...base,config:{...config,jev:false},settings:{...defaultSettings,quality:"medium",batch:1}});
 expect(withoutJev.costShort).toBe("~$0.03 + score");
 expect(generationReadiness({...base,tool:"analyze",hasSource:true}).costShort).toBeUndefined();
 expect(generationReadiness({...base,tool:"title",titleIdeas:true}).costShort).toBeUndefined();
});

it("key note names the connected provider and only asks to connect when a key is missing",()=>{
 const connect={text:"Uses your own API key.",link:"Open Keys to connect.",connected:false};
 expect(generationReadiness({...base,cloud:false}).keyNote).toEqual(connect);
 expect(generationReadiness({...base,loading:true}).keyNote).toEqual(connect);
 expect(generationReadiness({...base,config:{...config,connectionStatus:"failed"}}).keyNote).toEqual(connect);
 expect(generationReadiness({...base,config:{...config,openai:false}}).keyNote).toEqual(connect);
 expect(generationReadiness({...base,config:{...config,openai:true}}).keyNote).toEqual({text:"Using your OpenAI key.",connected:true,provider:"OpenAI"});
 expect(generationReadiness({...base,settings:{...defaultSettings,model:"gemini-pro"},config:{...config,google:true}}).keyNote).toEqual({text:"Using your Google key.",connected:true,provider:"Google"});
 expect(generationReadiness({...base,settings:{...defaultSettings,model:"gemini-pro"},config:{...config,openai:true,google:false}}).keyNote).toEqual(connect);
 expect(generationReadiness({...base,tool:"title",titleIdeas:true,textProvider:"google",config:{...config,google:true}}).keyNote.text).toBe("Using your Google key.");
});
