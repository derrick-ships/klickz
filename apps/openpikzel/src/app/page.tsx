import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Welcome } from "@/components/welcome";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const query=await searchParams;const entry=(await cookies()).get("openpikzels-entry")?.value;
 const mode=Array.isArray(query.mode)?query.mode[0]:query.mode;
 if(entry==="studio"||["recreate","generate","analyze","edit","title"].includes(mode||"")){
 const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(value!==undefined)for(const item of Array.isArray(value)?value:[value])params.append(key,item);
 redirect("/studio"+(params.size?"?"+params.toString():""));
 }return <Welcome/>;
}
