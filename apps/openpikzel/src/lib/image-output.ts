import type {Format} from "./types";
/** Native providers may round nominal aspect ratios to their pixel grid. */
export function nativeAspectMatches(width:number,height:number,format:Format){if(width<=0||height<=0)return false;const requested=format==="short"?9/16:16/9;return Math.abs(width/height/requested-1)<=.03;}
