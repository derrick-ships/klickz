import {authenticated,failure} from "@/lib/server";
import {analysisHistory} from "@/lib/analysis-history";
import {AppError} from "@/lib/validation";
export async function GET(request:Request){try{const {db,user,oauth}=await authenticated(request);if(oauth&&!oauth.scope.includes("studio:read"))throw new AppError(403,"Your agent lacks permission to read analysis history.");const query=new URL(request.url).searchParams;return Response.json(await analysisHistory(db,user.id,query.get("creationId")||"",query.get("cursor")),{headers:{"Cache-Control":"no-store"}});}catch(e){return failure(e);}}
