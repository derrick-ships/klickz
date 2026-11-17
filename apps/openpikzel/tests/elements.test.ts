import {it,expect} from 'vitest';
import {profileInput,profileRenameInput} from '../src/lib/profile-schema';
import {elementKinds,elementDefinitions,profileTable,unusedElementImages} from '../src/lib/elements';
import {writeDraftCheckpoint,readDraftCheckpoint} from '../src/lib/draft-checkpoint';
it('requires one to three images and a known element kind without persona consent',()=>{
 const input={kind:'element',name:'Acme',refs:['owner/logo.png'],elementKind:'logo'};
 expect(profileInput.parse(input).elementKind).toBe('logo');
 for(const invalid of [{...input,elementKind:undefined},{...input,elementKind:'person'},{...input,refs:[]},{...input,refs:['1','2','3','4']}])expect(profileInput.safeParse(invalid).success).toBe(false);
 expect(profileRenameInput.parse({kind:'element',id:'11111111-1111-4111-8111-111111111111',name:'Acme new'}).kind).toBe('element');
 expect(profileTable('element')).toBe('studio_elements');expect(elementKinds.every(k=>elementDefinitions[k].label&&elementDefinitions[k].description)).toBe(true);
});
it('retains selected elements in local draft checkpoints',()=>{let value='';const storage={getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;}};expect(writeDraftCheckpoint(storage,'owner',{chatId:null,draft:{elementIds:['logo']}})).toBe(true);expect(readDraftCheckpoint(storage,'owner')?.draft.elementIds).toEqual(['logo']);});

it('preserves images referenced by a persona, style, other element or creation',()=>{expect(unusedElementImages(['persona','style','element','creation','unused','unused'],['persona','style','element','creation',null])).toEqual(['unused']);});
