import {NextResponse} from 'next/server';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {profileInput} from '@/lib/profile-schema';
import {ownedAsset} from '@/lib/assets';
import {authenticated,failure} from '@/lib/server';
import {sameOrigin} from '@/lib/crypto';
import {limitedJson} from '@/lib/oauth/http';
import {AppError} from '@/lib/validation';
export async function POST(request:Request){
 try{
  const {db,user,oauth}=await authenticated(request);if(!oauth)sameOrigin(request);
  if(oauth&&!oauth.scope.includes('studio:write'))throw new AppError(403,'Allow workspace write access to create profiles.');
  const raw=await limitedJson(request,12000),input=profileInput.parse(raw);
  const images=await Promise.all(input.refs.map(p=>ownedAsset(db,user.id,p)));
  const digests=new Set(images.map(b=>createHash('sha256').update(b).digest('hex')));
  if(digests.size!==3)throw new AppError(400,'Choose three different reference images.');
  for(const image of images){const meta=await sharp(image,{limitInputPixels:40000000}).metadata();if(!['png','jpeg','webp'].includes(meta.format||'')||!meta.width||!meta.height||image.length>5*1024*1024)throw new AppError(400,'Use three PNG, JPG or WebP images under5MB.');}
  const row:Record<string,unknown>={name:input.name,notes:input.notes,refs:input.refs,user_id:user.id,profile_status:'draft',...(input.kind==='persona'?{consent_at:new Date().toISOString()}:{source:input.source||{}})};
  const result=await db.from(input.kind==='persona'?'studio_personas':'studio_styles').insert(row).select('*').single();
  if(result.error)throw result.error;
  return NextResponse.json({profile:result.data,method:'reference-guided'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
