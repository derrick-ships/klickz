import { AppError } from "./validation";
import { youtubeRead } from "./youtube";
export function youtubeVideoId(value:string):string {
  let url:URL;
  try{url=new URL(value);}catch{throw new AppError(400,"Use a YouTube video URL, or leave the video link empty.");}
  if(url.protocol!=="https:"||url.username||url.password||url.port||!["youtube.com","www.youtube.com","m.youtube.com","youtu.be"].includes(url.hostname))
    throw new AppError(400,"Use an official HTTPS YouTube video URL.");
  const parts=url.pathname.split("/").filter(Boolean);
  const id=url.hostname==="youtu.be"?parts[0]:url.pathname==="/watch"?url.searchParams.get("v"):["shorts","live","embed"].includes(parts[0])?parts[1]:null;
  if(!id||!/^[-\w]{11}$/.test(id))throw new AppError(400,"This link does not identify a YouTube video.");
  return id;
}
export type VideoEvidence={url:string;kind:"youtube-description"|"unavailable";title?:string;description?:string;notice:string};
export async function readVideoEvidence(url:string,key?:string):Promise<VideoEvidence>{
  const id=youtubeVideoId(url),canonical="https://www.youtube.com/watch?v="+id;
  if(!key)return {url:canonical,kind:"unavailable",notice:"Video details could not be read: no YouTube API key is connected. The video itself was not watched."};
  try{
    const data=await youtubeRead(key,"videos",{part:"snippet",id});
    const snippet=data.items?.[0]?.snippet;
    if(!snippet||typeof snippet.title!=="string")throw Error("unavailable");
    return {url:canonical,kind:"youtube-description",title:snippet.title.slice(0,100),description:typeof snippet.description==="string"?snippet.description.slice(0,2400):"",
      notice:"Used the video's public YouTube title and description. This is not a transcript or verification of the video's contents."};
  }catch{
    return {url:canonical,kind:"unavailable",notice:"YouTube video details are unavailable. The analysis uses the supplied thumbnail and title; the video itself was not watched."};
  }
}
