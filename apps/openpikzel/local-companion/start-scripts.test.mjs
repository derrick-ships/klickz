import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chmod,copyFile,mkdir,mkdtemp,rm,writeFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';

const exec=promisify(execFile);
const here=dirname(fileURLToPath(import.meta.url));
const MESSAGE='first launch: installing image support, needs internet once';

async function stage(t){
 const dir=await mkdtemp(join(tmpdir(),'openpikzels-start-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const name of ['start-linux.sh','Start OpenPikzels.command','install-image-support.sh']){
  try{
   await copyFile(join(here,name),join(dir,name));
   await chmod(join(dir,name),0o755);
  }catch(error){
   if(error.code!=='ENOENT')throw error;
  }
 }
 await writeFile(join(dir,'server.mjs'),'console.log("booted");\n');
 const bin=join(dir,'bin');
 await mkdir(bin,{recursive:true});
 return {dir,bin};
}

async function writeNpm(bin,code=0){
 const path=join(bin,'npm');
 await writeFile(path,'#!/bin/sh\nprintf \'npm-called %s\\n\' "$*"\nexit '+code+'\n',{mode:0o755});
 return path;
}

async function runLauncher(dir,bin,script){
 const result=await exec('/bin/sh',[join(dir,script)],{
  cwd:dir,
  env:{...process.env,PATH:bin+delimiter+process.env.PATH},
  timeout:15000,
 });
 return {stdout:result.stdout||'',stderr:result.stderr||''};
}

async function assertLauncher(t,script){
 const present=await stage(t);
 await writeNpm(present.bin,0);
 await mkdir(join(present.dir,'node_modules','sharp'),{recursive:true});
 await writeFile(join(present.dir,'node_modules/sharp/package.json'),'{"name":"sharp"}\n');
 const skipped=await runLauncher(present.dir,present.bin,script);
 assert.equal(skipped.stdout.includes(MESSAGE),false);
 assert.equal(skipped.stdout.includes('npm-called'),false);
 assert.match(skipped.stdout,/^booted$/m);

 const missing=await stage(t);
 await writeNpm(missing.bin,0);
 const installed=await runLauncher(missing.dir,missing.bin,script);
 assert.match(installed.stdout,new RegExp('^'+MESSAGE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','m'));
 assert.equal(installed.stdout.split('\n').filter(line=>line===MESSAGE).length,1);
 assert.match(installed.stdout,/npm-called ci --omit=dev/);
 assert.match(installed.stdout,/^booted$/m);

 const failed=await stage(t);
 await writeNpm(failed.bin,1);
 const booted=await runLauncher(failed.dir,failed.bin,script);
 assert.match(booted.stdout,new RegExp('^'+MESSAGE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','m'));
 assert.match(booted.stdout,/npm-called ci --omit=dev/);
 assert.match(booted.stdout,/^booted$/m);
}

test('start-linux.sh skips install when sharp is present, installs when missing, and still boots if install fails',async t=>{
 await access(join(here,'start-linux.sh'),constants.R_OK);
 await assertLauncher(t,'start-linux.sh');
});

test('Start OpenPikzels.command skips install when sharp is present, installs when missing, and still boots if install fails',async t=>{
 await access(join(here,'Start OpenPikzels.command'),constants.R_OK);
 await assertLauncher(t,'Start OpenPikzels.command');
});
