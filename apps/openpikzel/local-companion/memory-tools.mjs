const textResult=v=>({content:[{type:'text',text:JSON.stringify(v)}]});
export const memoryToolDefinitions=[
 {name:'memory_write',description:'Remember a short fact for this user in their private OpenPikzels memory.',inputSchema:{type:'object',properties:{fact:{type:'string'},tags:{type:'array',items:{type:'string'}},agent:{type:'string'},source:{type:'string'}},required:['fact']}},
 {name:'memory_recall',description:"Recall this user's newest matching remembered facts, at most 20.",inputSchema:{type:'object',properties:{query:{type:'string'}}}}
];
function argsOf(args,keys){
 const out={};for(const key of keys)if(args?.[key]!==undefined)out[key]=args[key];return out;
}
export async function callMemoryTool(name,args,{client,linked}={}){
 if(!linked)return textResult({status:'not_linked',instruction:'The OpenPikzels account is not linked. Call suggest_service so the user can connect it.'});
 if(name==='memory_write')return client.callTool({name:'remember_fact',arguments:argsOf(args,['fact','tags','agent','source'])});
 if(name==='memory_recall')return client.callTool({name:'recall_facts',arguments:argsOf(args,['query'])});
 throw new Error('Unsupported host tool.');
}
