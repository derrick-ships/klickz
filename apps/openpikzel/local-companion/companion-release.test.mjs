import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const exec=promisify(execFile);
const here=dirname(fileURLToPath(import.meta.url));
const appRoot=join(here,'..');
const script=join(appRoot,'scripts/build-companion.py');

test('the companion release zip does not contain web-network-fixture.mjs',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'openpikzels-companion-zip-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const dest=join(dir,'openpikzels-local-companion.zip');
 await exec('python3',[script],{env:{...process.env,COMPANION_ZIP:dest},timeout:30000});
 const {stdout}=await exec('python3',['-c','from zipfile import ZipFile,sys; print("\\n".join(ZipFile(sys.argv[1]).namelist()))',dest]);
 assert.match(stdout,/vision-tools\.mjs/m);
 assert.equal(stdout.includes('web-network-fixture.mjs'),false);
});
