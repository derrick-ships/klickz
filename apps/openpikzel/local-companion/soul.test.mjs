import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {soul} from './soul.mjs';
import {Engine} from './engine.mjs';

test('the companion context loads the same soul.md as the web app',async t=>{
 const sentinel='SENTINEL RULE: The thumbnail never repeats the title.';
 assert.ok(soul().includes(sentinel));
 const dir=await mkdtemp(join(tmpdir(),'openpikzels-soul-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const engine=new Engine(dir);t.after(()=>engine.close());
 const context=await engine.context('default');
 assert.ok(context.includes(sentinel));
 assert.ok(context.indexOf(sentinel)<context.indexOf('Human interaction tools available'));
});
