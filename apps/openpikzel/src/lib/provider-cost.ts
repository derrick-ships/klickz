import type {Settings} from "./types";
export const pricingCheckedOn="2026-11-09";
export const imagePricingSources={openai:"https://developers.openai.com/api/docs/guides/image-generation#calculating-costs",google:"https://ai.google.dev/gemini-api/docs/pricing"};
// Standard list-price image output only. Input, thinking/text and review usage are additional.
// OpenAI's published calculator uses nearest-even rounding for the short token-grid edge.
export function imageOutputEstimate(settings:Settings){
 if(settings.model==="gemini-flash"||settings.model==="gemini-pro"){const perImage=settings.model==="gemini-flash"?0.067:0.134;return{perImage,batch:perImage*settings.batch,source:imagePricingSources.google};}
 const grid={low:16,medium:24,high:48,xhigh:64,max:96}[settings.quality],factor={low:4.2,medium:3.3,high:1,xhigh:1,max:1}[settings.quality];
 const width=settings.format==="short"?864:1536,height=settings.format==="short"?1536:864;
 const shortGrid=grid/(Math.max(width,height)/Math.min(width,height)),floor=Math.floor(shortGrid),rounded=shortGrid-floor===0.5?floor+floor%2:Math.round(shortGrid);
 const tokens=Math.round(Math.ceil(grid*rounded*(2000000+width*height)/4000000)*factor),perImage=tokens*30/1000000;
 return{perImage,batch:perImage*settings.batch,source:imagePricingSources.openai};
}
export function imageCostCopy(settings:Settings){const price=imageOutputEstimate(settings);return "Estimated image output: $"+price.perImage.toFixed(3)+" per image · $"+price.batch.toFixed(3)+" for "+settings.batch+". Standard list prices checked "+pricingCheckedOn+". Inputs, text/thinking and any analysis are extra; the total remains unknown. Your provider bills your account.";}
// Short form for the generate button: the whole request's image output, rounded up to the cent so it never understates.
export function imageCostCents(settings:Settings){return Math.ceil(imageOutputEstimate(settings).batch*100-1e-9)/100;}
export function imageCostShort(settings:Settings){return "~$"+imageCostCents(settings).toFixed(2);}
