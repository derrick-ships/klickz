import {z} from 'zod';
import {authenticated,failure} from '@/lib/server';
import {sameOrigin} from '@/lib/crypto';
import {fetchReference} from '@/lib/reference';
import {AppError} from '@/lib/validation';
export async function POST(request:Request){try{const {oauth}=await authenticated(request);if(!oauth)sameOrigin(request);if(oauth&&!oauth.scope.includes('studio:write'))throw new AppError(403,'Allow write access to import a reference.');const {videoId}=z.object({videoId:z.string().regex(/^[\w-]{11}$/)}).parse(await request.json());const image=await fetchReference('https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg',0,['i.ytimg.com']);return new Response(new Uint8Array(image),{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});}catch(e){return failure(e);}}
