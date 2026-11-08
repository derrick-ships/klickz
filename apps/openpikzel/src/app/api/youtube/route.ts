import {z} from 'zod';
import {NextResponse} from 'next/server';
import {authenticated,failure} from '@/lib/server';
import {sameOrigin} from '@/lib/crypto';
import {limitedJson} from '@/lib/oauth/http';
import {userKeys} from '@/lib/provider-context';
import {channelVideos} from '@/lib/youtube';
import {AppError} from '@/lib/validation';
export async function POST(request:Request){
 try{
  const {db,user,oauth}=await authenticated(request);if(!oauth)sameOrigin(request);
  if(oauth&&!oauth.scope.includes('studio:read'))throw new AppError(403,'Allow workspace read access to browse references.');
  const input=z.object({channel:z.string().trim().min(1).max(300),order:z.enum(['recent','popular']).default('recent'),pageToken:z.string().max(300).default('')}).parse(await limitedJson(request,2000));
  const keys=await userKeys(db,user.id);if(!keys.youtube)throw new AppError(403,'Connect your own YouTube Data API key in Connections to browse a channel. You can also upload three thumbnails.');
  return NextResponse.json(await channelVideos(keys.youtube,input.channel,input.order,input.pageToken),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
