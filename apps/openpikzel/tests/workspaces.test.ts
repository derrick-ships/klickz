import {describe,it,expect} from 'vitest';
describe('creative workspace contracts',()=>{
 it('requires3photos, a3-character name and explicit persona permission',async()=>{
  const {profileInput}=await import('../src/lib/profile-schema');
  expect(profileInput.safeParse({kind:'persona',name:'ab',notes:'',refs:['a','b','c'],permission:true}).success).toBe(false);
  expect(profileInput.safeParse({kind:'persona',name:'Alice',notes:'',refs:['a','b'],permission:true}).success).toBe(false);
  expect(profileInput.safeParse({kind:'persona',name:'Alice',notes:'',refs:['a','b','c'],permission:false}).success).toBe(false);
  expect(profileInput.safeParse({kind:'persona',name:'Alice',notes:'',refs:['a','b','c'],permission:true}).success).toBe(true);
 });
 it('accepts only official channel IDs, handles and YouTube channel URLs',async()=>{
  const {channelIdentifier}=await import('../src/lib/youtube');
  expect(channelIdentifier('@channel')).toEqual({forHandle:'@channel'});
  expect(channelIdentifier('https://www.youtube.com/@channel/videos')).toEqual({forHandle:'@channel'});
  expect(channelIdentifier('https://youtube.com/channel/UCabcdefghijklmnopqrstuv')).toEqual({id:'UCabcdefghijklmnopqrstuv'});
  for(const v of ['https://evil.example/@channel','https://youtube.com.evil.example/@channel','http://127.0.0.1/','https://youtube.com/watch?v=bad'])expect(()=>channelIdentifier(v)).toThrow();
 });
 it('groups chats by local date and searches titles plus exact saved prompts',async()=>{
  const {groupChats,searchChats}=await import('../src/lib/workspaces');
  const chats=[{id:'a',title:'Split faces',created_at:'2026-11-08T10:00:00Z',updated_at:'2026-11-08T10:00:00Z',draft:{}},{id:'b',title:'Old idea',created_at:'2026-11-07T10:00:00Z',updated_at:'2026-11-07T10:00:00Z',draft:{}}];
  expect(groupChats(chats,new Date('2026-11-08T12:00:00Z')).map(g=>g.label)).toEqual(['Today','Yesterday']);
  expect(searchChats(chats,[{conversation_id:'b',prompt:'A skeleton holding a smartphone'}] as any,'smartphone').map(x=>x.id)).toEqual(['b']);
 });
 it('normalizes verified YouTube video IDs and durations without trusting arbitrary image URLs',async()=>{
  const {videoCards,formatDuration}=await import('../src/lib/youtube');
  expect(formatDuration('PT1H2M3S')).toBe('1:02:03');
  const cards=videoCards({items:[{id:'abcdefghijk',snippet:{title:'Example',channelId:'UCabcdefghijklmnopqrstuv'},statistics:{viewCount:'1234'},contentDetails:{duration:'PT4M2S'}}]});
  expect(cards[0]).toMatchObject({id:'abcdefghijk',duration:'4:02',views:1234,thumbnail:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'});
  expect(videoCards({items:[null,{}, {id:'../bad'}]})).toEqual([]);
 });
});
