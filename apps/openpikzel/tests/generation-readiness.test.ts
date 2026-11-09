import {describe,it,expect} from "vitest";
import {generationReadiness} from "../src/lib/generation-readiness";
import {defaultSettings,type Config} from "../src/lib/types";
import {imageModel} from "../src/lib/image-models";
const config:Config={cloud:true,ai:true,openai:true,jev:true,google:false,supabaseUrl:"",supabaseKey:"",ownerGate:false,textModels:{openai:"configured-openai-text",google:"configured-google-text"},scoreModel:"configured-jev"};
const base={config,cloud:true,loading:false,tool:"generate",titleIdeas:false,settings:defaultSettings,prompt:"A clear visual idea",title:"",hasSource:false,hasReferences:false,includeVision:false};
describe("request readiness",()=>{
 it("does not treat any connected image provider as the selected provider",()=>{expect(generationReadiness({...base,settings:{...defaultSettings,model:"gemini-pro"}}).readiness).toContain("Connect your Google");expect(generationReadiness({...base,config:{...config,openai:false,google:true}}).readiness).toContain("Connect your OpenAI");});
 it("shows actual mappings and explicitly unknown spend",()=>{const r=generationReadiness({...base,settings:{...defaultSettings,batch:4,format:"short"}});expect(r.identity).toContain(imageModel("flare").apiModel);expect(r.quantity).toBe("4 images · 9:16");expect(r.cost).toContain("cannot be estimated");expect(r.readiness).toContain("Connection saved");});
 it("explains sign-in, disabled AI, missing source and incomplete prompt",()=>{expect(generationReadiness({...base,cloud:false}).readiness).toContain("Sign in");expect(generationReadiness({...base,config:{...config,ai:false}}).readiness).toContain("not enabled");expect(generationReadiness({...base,tool:"edit"}).readiness).toContain("Choose an image");expect(generationReadiness({...base,tool:"recreate"}).readiness).toContain("reference");expect(generationReadiness({...base,prompt:""}).readiness).toContain("eight");});
 it("uses the backend text fallback and explains optional vision dependency",()=>{const r=generationReadiness({...base,tool:"title",titleIdeas:true,config:{...config,openai:false,google:true}});expect(r.identity).toBe("Google · configured-google-text");expect(r.quantity).toBe("Five title ideas");expect(generationReadiness({...base,tool:"analyze",hasSource:true,includeVision:true,config:{...config,openai:false,google:false}}).readiness).toContain("extra image review");});
});
