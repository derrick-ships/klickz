import {profileTable} from '@/lib/elements';
import {NextResponse} from 'next/server';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {profileInput,profileRenameInput} from '@/lib/profile-schema';
import {assertUniqueProfileName,profileNameTakenError,resolveProfileName,type ProfileKind} from '@/lib/profile-name';
import {ownedAsset} from '@/lib/assets';
import {authenticated,failure} from '@/lib/server';
import {sameOrigin} from '@/lib/crypto';
import {limitedJson} from '@/lib/oauth/http';
import {AppError} from '@/lib/validation';

const tableFor=profileTable;

async function ownedNames(db:any,userId:string,kind:ProfileKind){
 const result=await db.from(tableFor(kind)).select('id,name').eq('user_id',userId);
 if(result.error)throw result.error;
 return (result.data||[]) as Array<{id:string;name:string}>;
}

function uniqueViolation(error:unknown){
 return typeof error==='object'&&error!==null&&'code' in error&&(error as{code?:string}).code==='23505';
}

export async function GET(request:Request){
 try{
  const {db,user,oauth}=await authenticated(request);if(!oauth)sameOrigin(request);
  if(oauth&&!oauth.scope.includes('studio:read'))throw new AppError(403,'Allow workspace read access to resolve profiles.');
  const url=new URL(request.url);
  const kind=url.searchParams.get('kind');
  const name=url.searchParams.get('name')??'';
  if(kind!=='persona'&&kind!=='style'&&kind!=='element')throw new AppError(400,'Check the request fields and try again.');
  const rows=await db.from(tableFor(kind)).select('*').eq('user_id',user.id);
  if(rows.error)throw rows.error;
  const resolved=resolveProfileName(rows.data||[],name,kind);
  if(resolved.status!==200)throw new AppError(resolved.status,resolved.error);
  return NextResponse.json({profile:resolved.profile},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}

export async function POST(request:Request){
 try{
  const {db,user,oauth}=await authenticated(request);if(!oauth)sameOrigin(request);
  if(oauth&&!oauth.scope.includes('studio:write'))throw new AppError(403,'Allow workspace write access to create profiles.');
  const raw=await limitedJson(request,12000),input=profileInput.parse(raw);
  const images=await Promise.all(input.refs.map(p=>ownedAsset(db,user.id,p)));
  const digests=new Set(images.map(b=>createHash('sha256').update(b).digest('hex')));
  if(digests.size!==images.length)throw new AppError(400,'Choose different reference images.');
  for(const image of images){const meta=await sharp(image,{limitInputPixels:40000000}).metadata();if(!['png','jpeg','webp'].includes(meta.format||'')||!meta.width||!meta.height||image.length>5*1024*1024)throw new AppError(400,'Use 2 or 3 PNG, JPG or WebP images under 5 MB.');}
  assertUniqueProfileName(await ownedNames(db,user.id,input.kind),input.name,input.kind);
  const row:Record<string,unknown>={name:input.name,notes:input.notes,refs:input.refs,user_id:user.id,profile_status:'draft',...(input.kind==='persona'?{consent_at:new Date().toISOString()}:input.kind==='element'?{kind:input.elementKind}:{source:input.source||{}})};
  const result=await db.from(tableFor(input.kind)).insert(row).select('*').single();
  if(result.error){if(uniqueViolation(result.error))throw new AppError(409,profileNameTakenError(input.kind,input.name));throw result.error;}
  return NextResponse.json({profile:result.data,method:'reference-guided'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}

export async function PATCH(request:Request){
 try{
  const {db,user,oauth}=await authenticated(request);if(!oauth)sameOrigin(request);
  if(oauth&&!oauth.scope.includes('studio:write'))throw new AppError(403,'Allow workspace write access to rename profiles.');
  const raw=await limitedJson(request,4000),input=profileRenameInput.parse(raw);
  const existing=await ownedNames(db,user.id,input.kind);
  if(!existing.some((row)=>row.id===input.id))throw new AppError(404,'This profile could not be found.');
  assertUniqueProfileName(existing,input.name,input.kind,input.id);
  const result=await db.from(tableFor(input.kind)).update({name:input.name}).eq('id',input.id).eq('user_id',user.id).select('*').single();
  if(result.error){if(uniqueViolation(result.error))throw new AppError(409,profileNameTakenError(input.kind,input.name));throw result.error;}
  if(!result.data)throw new AppError(404,'This profile could not be found.');
  return NextResponse.json({profile:result.data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
