import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
// Separate encrypted local token/key store. No vendor auth files are opened.
export class Vault{
 constructor(directory){this.directory=directory;this.chain=Promise.resolve();}
 async ready(){await mkdir(this.directory,{recursive:true,mode:0o700});await chmod(this.directory,0o700);const p=join(this.directory,'vault.key');try{this.key=await readFile(p);}catch(e){if(e.code!=='ENOENT')throw e;try{await writeFile(p,randomBytes(32),{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}this.key=await readFile(p);}if(this.key.length!==32)throw new Error('Invalid local key store.');await chmod(p,0o600);}
 async data(){await this.ready();try{return JSON.parse(await readFile(join(this.directory,'vault.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw new Error('The local key store could not be read.');}}
 async get(id){await this.chain;const data=await this.data(),v=data[id];if(!v)return null;try{const decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(v.iv,'base64'));decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(v.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(v.data,'base64')),decipher.final()]).toString());}catch{throw new Error('The local credential could not be decrypted.');}}
 set(id,value){const operation=this.chain.then(async()=>{const data=await this.data();if(value===null)delete data[id];else{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(Buffer.from(id));data[id]={iv:iv.toString('base64'),data:Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('base64')};}
 const file=join(this.directory,'vault.json'),temp=file+'.'+randomBytes(8).toString('hex');await writeFile(temp,JSON.stringify(data),{mode:0o600,flag:'wx'});await rename(temp,file);});
 this.chain=operation.catch(()=>{});return operation;}
}
