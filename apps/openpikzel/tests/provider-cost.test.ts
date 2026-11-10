import {describe,it,expect} from "vitest";
import {imageCostShort,imageOutputEstimate} from "../src/lib/provider-cost";
import {defaultSettings} from "../src/lib/types";
describe("short image cost for the generate button",()=>{
 it("rounds the request's image-output estimate up to the cent so the button never understates it",()=>{
  for(const [quality,want] of [["low","~$0.02"],["medium","~$0.03"],["high","~$0.04"],["xhigh","~$0.06"],["max","~$0.13"]] as const)expect(imageCostShort({...defaultSettings,quality,batch:1})).toBe(want);
 });
 it("covers every image in the batch",()=>{const settings={...defaultSettings,quality:"medium" as const,batch:4 as const,format:"short" as const};expect(imageOutputEstimate(settings).batch).toBeCloseTo(0.111,3);expect(imageCostShort(settings)).toBe("~$0.12");});
 it("uses the selected provider's published price",()=>{expect(imageCostShort({...defaultSettings,model:"gemini-flash",batch:1})).toBe("~$0.07");expect(imageCostShort({...defaultSettings,model:"gemini-pro",batch:2})).toBe("~$0.27");});
});
