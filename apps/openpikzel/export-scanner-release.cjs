const fs=require("fs"),crypto=require("crypto"),path=require("path");
const base=JSON.parse(fs.readFileSync("auth-deploy-refs.json","utf8")),old=new Map(base.map(x=>[x.file,x.sha]));
// Discover source/test additions instead of maintaining a second, incomplete hand-written list.
const discovered=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.posix.join(dir,item.name);if(item.isSymbolicLink())throw Error("Source symlinks require review: "+file);if(item.isDirectory())walk(file);else if(item.isFile())discovered.push(file);}}
walk("src");walk("tests");
const paths=[...new Set([...base.map(x=>x.file),...discovered,"export-scanner-release.cjs","docs/scanner-feed-recompose.md"])].sort(),refs=[],gitHashes=[],changed=[];
function sha(x){return crypto.createHash("sha1").update(x).digest("hex");}
for(const file of paths){
 if(path.isAbsolute(file)||file.split("/").some(segment=>segment===".."||segment.startsWith(".env")&&segment!==".env.example"))throw Error("Unexpected export path: "+file);
 if(!fs.lstatSync(file).isFile())throw Error("Expected a source file: "+file);
 const bytes=fs.readFileSync(file),digest=sha(bytes),gitSha=sha(Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes]));refs.push({file,sha:digest,size:bytes.length});gitHashes.push({path:"apps/openpikzel/"+file,sha:gitSha});
 if(old.get(file)!==digest){const content=bytes.toString("utf8");if(!Buffer.from(content).equals(bytes))throw Error("Changed binary needs separate handling: "+file);changed.push({file,sha:digest,size:bytes.length,gitSha,content,base64:bytes.toString("base64")});}
}
const bundle=JSON.stringify(changed),chunks=[];
if(!process.argv.includes("--check")){
 for(let i=0;i<bundle.length;i+=48000){const file=".scanner-export-"+chunks.length+".json";fs.writeFileSync(file,JSON.stringify(bundle.slice(i,i+48000)));chunks.push(file);}
 fs.writeFileSync(".scanner-export-meta.json",JSON.stringify({refs,gitHashes,chunks,changed:changed.map(({file,sha,size,gitSha})=>({file,sha,size,gitSha}))}));
}
console.log(JSON.stringify({files:refs.length,changed:changed.length,chunks:chunks.length,checkOnly:process.argv.includes("--check")}));
