"use client";
import {useEffect,useState} from "react";
import type {Format} from "@/lib/types";
import {nativeAspectMatches} from "@/lib/image-output";
export function NativeOutputNotice({src,requested,native=false}:{src:string;requested?:Format;native?:boolean}){
 const [reading,setReading]=useState<{src:string;width:number;height:number}|null>(null);
 useEffect(()=>{let active=true;const image=new Image();image.onload=()=>{if(active)setReading({src,width:image.naturalWidth,height:image.naturalHeight});};image.onerror=()=>{if(active)setReading({src,width:0,height:0});};image.src=src;return()=>{active=false;image.onload=null;image.onerror=null;};},[src]);
 if(reading?.src!==src)return null;
 if(!reading.width||!reading.height)return <p className="native-output-note">Dimensions are unavailable while the image preview cannot load. Refresh the preview to check again.</p>;
 const matches=!requested||nativeAspectMatches(reading.width,reading.height,requested);
 return <p className="native-output-note" role={matches?undefined:"status"}>Saved image · {reading.width} × {reading.height}.{!matches&&" Requested "+(requested==="short"?"9:16":"16:9")+"; the returned aspect ratio differs. No crop or automatic retry was applied."}</p>;
}
