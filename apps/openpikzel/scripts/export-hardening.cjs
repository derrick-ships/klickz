const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),skip=new Set(['node_modules','.next','.git','.superpowers','test-results','playwright-report']);
const baseline=JSON.parse(fs.readFileSync('source-manifest.json','utf8')),names=new Set(baseline.map(x=>x.file));
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){if(skip.has(e.name))continue;const name=path.posix.join(dir,e.name);if(e.isDirectory())walk(name);else if(!name.endsWith('.log'))names.add(name);}}
walk('local-companion');walk('scripts');walk('src/app/integrations/local-companion');names.add('docs/engine-hardening-plan.md');
names.add('evidence/engine-hardening-release.json');names.add('docs/engine-hardening-release.md');
const files=[...names].filter(file=>fs.existsSync(path.join(root,file))).map(file=>{const b=fs.readFileSync(path.join(root,file)),binary=/\.(png|jpg|jpeg|webp|gif|zip|ico|woff2?|mp4|webm)$/.test(file);return {file,data:b.toString(binary?'base64':'utf8'),encoding:binary?'base64':'utf-8'};});
fs.writeFileSync('release-manifest.json',JSON.stringify(files));console.log(JSON.stringify({files:files.length,characters:fs.statSync('release-manifest.json').size}));
