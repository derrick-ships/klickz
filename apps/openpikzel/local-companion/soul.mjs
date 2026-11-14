import {readFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
// The companion reads the same soul.md the web app is generated from: next to
// this file in the release zip, or at the app root in the repository.
const here=dirname(fileURLToPath(import.meta.url));
let cached;
export function soul(){
 if(cached!==undefined)return cached;
 const file=[join(here,'soul.md'),join(here,'..','soul.md')].find(existsSync);
 cached=file?readFileSync(file,'utf8'):'';
 return cached;
}
