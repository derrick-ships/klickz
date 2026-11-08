import {spawn} from 'node:child_process';
import {providerName} from './core.mjs';
const provider=providerName(process.argv[2]);
const child=spawn(provider,provider==='claude'?['auth','login']:['login'],{shell:false,stdio:'inherit'});
child.on('error',()=>{console.error('Install the official '+provider+' CLI, then reopen sign-in.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code||0;});
