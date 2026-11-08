import {auth,discoverOAuthServerInfo,refreshAuthorization} from '@modelcontextprotocol/sdk/client/auth.js';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {safeFetch,safeUrl} from './mcp-runtime.mjs';
export class McpOAuth{
 constructor(vault,{fetchFn=safeFetch,now=Date.now}={}){this.vault=vault;this.fetch=fetchFn;this.now=now;this.cookieKey=randomBytes(32);this.states=new Map();this.refreshes=new Map();}
 id(agent,name){return agent+'/oauth/'+name;}
 seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',this.cookieKey,iv);return Buffer.concat([iv,c.update(JSON.stringify(value)),c.final(),c.getAuthTag()]).toString('base64url');}
 unseal(value){try{const b=Buffer.from(value,'base64url'),d=createDecipheriv('aes-256-gcm',this.cookieKey,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString());}catch{throw new Error('Sign-in context expired. Start sign-in again.');}}
 cookie(state,value){return 'op_mcp_'+state+'='+value+'; HttpOnly; SameSite=Lax; Path=/api/mcp/oauth/callback; Max-Age='+(value?'600':'0');}
 async discover(config){await safeUrl(config.url);return discoverOAuthServerInfo(config.url,{fetchFn:this.fetch});}
 async start(agent,config,origin){
  if(config.transport==='stdio'||!config.url)throw new Error('This server uses local process authentication.');
  const id=this.id(agent,config.name),state=randomBytes(24).toString('hex'),ctx={agent,name:config.name,url:config.url,state,expires:this.now()+600000,verifier:''};
  const stored=await this.vault.get(id)||{};if(stored.resourceUrl&&stored.resourceUrl!==new URL(config.url).href)throw new Error('Disconnect this server before using a different resource URL.');stored.resourceUrl=new URL(config.url).href;let authorizationUrl;
  const provider={
   redirectUrl:origin+'/api/mcp/oauth/callback',
   clientMetadataUrl:'https://openpikzels.com/integrations/local-companion/client.json',
   clientMetadata:{client_name:'OpenPikzels local companion',redirect_uris:[origin+'/api/mcp/oauth/callback'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'},
   state:()=>state,clientInformation:()=>stored.client,
   saveClientInformation:async client=>{stored.client=client;await this.vault.set(id,stored);},
   tokens:()=>undefined,saveTokens:async tokens=>{stored.tokens={...tokens,expires_at:tokens.expires_in?this.now()+tokens.expires_in*1000:undefined};await this.vault.set(id,stored);},
   redirectToAuthorization:url=>{authorizationUrl=String(url);},
   saveCodeVerifier:v=>{ctx.verifier=v;},codeVerifier:()=>ctx.verifier,
   saveDiscoveryState:async discovery=>{stored.discovery=discovery;await this.vault.set(id,stored);},
   discoveryState:()=>stored.discovery,
   invalidateCredentials:async()=>{delete stored.tokens;await this.vault.set(id,stored);}
  };
  const result=await auth(provider,{serverUrl:config.url,fetchFn:this.fetch});
  if(result!=='REDIRECT'||!authorizationUrl||!ctx.verifier)throw new Error('The server did not provide an interactive sign-in flow.');
  await safeUrl(authorizationUrl);
  this.states.set(state,{agent,name:config.name,expires:ctx.expires});
  return {state,url:authorizationUrl,cookie:this.cookie(state,this.seal(ctx))};
 }
 async callback(query,cookieHeader,origin){
  const state=query.get('state');if(!state||!/^[a-f0-9]{48}$/.test(state))throw new Error('Invalid sign-in state.');
  const pending=this.states.get(state);this.states.delete(state);
  if(!pending||pending.expires<this.now())throw new Error('Sign-in expired or was already used.');
  const cookies=Object.fromEntries((cookieHeader||'').split(';').map(p=>p.trim().split('=')));
  const ctx=this.unseal(cookies['op_mcp_'+state]||'');
  if(ctx.state!==state||ctx.expires<this.now()||ctx.agent!==pending.agent||ctx.name!==pending.name)throw new Error('Sign-in context mismatch.');
  if(query.has('error'))return {state,ok:false,name:ctx.name,cookie:this.cookie(state,'')};
  const code=query.get('code');if(!code||code.length>4096)throw new Error('The provider did not return an authorization code.');
  const id=this.id(ctx.agent,ctx.name),stored=await this.vault.get(id)||{};
  const provider={
   redirectUrl:origin+'/api/mcp/oauth/callback',clientMetadata:{redirect_uris:[origin+'/api/mcp/oauth/callback'],token_endpoint_auth_method:'none'},
   state:()=>state,clientInformation:()=>stored.client,tokens:()=>undefined,
   saveTokens:async tokens=>{stored.tokens={...tokens,expires_at:tokens.expires_in?this.now()+tokens.expires_in*1000:undefined};delete stored.refreshing;await this.vault.set(id,stored);},
   saveCodeVerifier:()=>{},codeVerifier:()=>ctx.verifier,redirectToAuthorization:()=>{throw new Error('Provider requested a new sign-in.');},
   discoveryState:()=>stored.discovery,saveDiscoveryState:async d=>{stored.discovery=d;await this.vault.set(id,stored);}
  };
  const result=await auth(provider,{serverUrl:ctx.url,authorizationCode:code,fetchFn:this.fetch});
  if(result!=='AUTHORIZED')throw new Error('Sign-in did not finish.');return {state,ok:true,name:ctx.name,agent:ctx.agent,cookie:this.cookie(state,'')};
 }
 async token(agent,config){
  const id=this.id(agent,config.name);if(this.refreshes.has(id))return this.refreshes.get(id);
  const work=(async()=>{
   const stored=await this.vault.get(id);if(!stored?.tokens)return undefined;
   if(!config.url||stored.resourceUrl!==new URL(config.url).href)throw new Error('Reconnect this MCP server: its resource URL is different or unbound.');
   if(stored.refreshing)throw new Error('Previous token refresh has an uncertain outcome. Reconnect this MCP server.');
   const t=stored.tokens;if(!t.expires_at||t.expires_at>this.now()+60000)return t;
   if(!t.refresh_token)throw new Error('MCP sign-in expired. Reconnect this server.');
   stored.refreshing=true;await this.vault.set(id,stored); // Persist before rotating; never reuse after an uncertain request.
   try{
    const d=stored.discovery;const tokens=await refreshAuthorization(d.authorizationServerUrl,{metadata:d.authorizationServerMetadata,clientInformation:stored.client,refreshToken:t.refresh_token,resource:d.resourceMetadata?.resource,fetchFn:this.fetch});
    stored.tokens={...tokens,refresh_token:tokens.refresh_token||t.refresh_token,expires_at:tokens.expires_in?this.now()+tokens.expires_in*1000:undefined};delete stored.refreshing;await this.vault.set(id,stored);return stored.tokens;
   }catch{throw new Error('MCP refresh failed. Reconnect this server; automatic refresh retry is disabled.');}
  })();this.refreshes.set(id,work);try{return await work;}finally{this.refreshes.delete(id);}
 }
 async deviceStart(agent,config){
  const id=this.id(agent,config.name),stored=await this.vault.get(id)||{},d=stored.discovery||await this.discover(config),m=d.authorizationServerMetadata;
  if(stored.resourceUrl&&stored.resourceUrl!==new URL(config.url).href)throw new Error('Reconnect for this resource.');stored.resourceUrl=new URL(config.url).href;
  if(!m?.device_authorization_endpoint||!stored.client?.client_id)throw new Error('Device sign-in is not advertised or no client is registered. Use browser sign-in.');
  const params=new URLSearchParams({client_id:stored.client.client_id,...(d.resourceMetadata?.scopes_supported?{scope:d.resourceMetadata.scopes_supported.join(' ')}:{})});
  const response=await this.fetch(m.device_authorization_endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params});
  if(!response.ok)throw new Error('Device sign-in could not start.');const v=await response.json();
  if(!v.device_code||!v.user_code||!v.verification_uri)throw new Error('Unsupported device sign-in response.');
  await safeUrl(v.verification_uri);stored.discovery=d;stored.device={code:v.device_code,expires:this.now()+Math.min(v.expires_in||600,1800)*1000,interval:Math.max(v.interval||5,5)*1000,next:0};await this.vault.set(id,stored);
  return {userCode:v.user_code,url:v.verification_uri,expiresAt:stored.device.expires};
 }
 async deviceComplete(agent,config){
  const id=this.id(agent,config.name),stored=await this.vault.get(id),d=stored?.device;
  if(!d||d.expires<this.now())throw new Error('Device sign-in expired.');
  if(d.next>this.now())return {pending:true,retryAt:d.next};d.next=this.now()+d.interval;await this.vault.set(id,stored);
  const r=await this.fetch(stored.discovery.authorizationServerMetadata.token_endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:d.code,client_id:stored.client.client_id})}),v=await r.json();
  if(v.error==='authorization_pending'||v.error==='slow_down'){if(v.error==='slow_down'){d.interval+=5000;d.next=this.now()+d.interval;await this.vault.set(id,stored);}return {pending:true,retryAt:d.next};}
  if(!r.ok||!v.access_token){delete stored.device;await this.vault.set(id,stored);throw new Error('Device sign-in was denied or expired.');}
  stored.tokens={...v,expires_at:v.expires_in?this.now()+v.expires_in*1000:undefined};delete stored.device;await this.vault.set(id,stored);return {ok:true};
 }
}
export function callbackHtml(result,origin,nonce){
 const data=JSON.stringify({type:'openpikzels:mcp-oauth',state:result.state,ok:result.ok,name:result.name}).replace(/</g,'\\u003c');
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OpenPikzels connection</title><style nonce="'+nonce+'">body{color-scheme:dark;background:#101010;color:#fff;font:18px/1.6 system-ui;padding:40px;max-width:600px;margin:auto}h1{color:#ff4b60}</style><h1>'+(result.ok?'Connected':'Sign-in cancelled')+'</h1><p>Return to your OpenPikzels companion. You can close this window.</p><script nonce="'+nonce+'">const result='+data+';try{new BroadcastChannel("openpikzels:mcp").postMessage(result)}catch{};try{window.opener?.postMessage(result,'+JSON.stringify(origin)+')}catch{};</script></html>';
}
