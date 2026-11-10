import {build} from 'esbuild';
await build({entryPoints:['local-companion/runtime-entry.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',external:['sharp'],outfile:'local-companion/runtime.mjs',banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"},legalComments:'linked'});
console.log('Companion runtime bundled with license notices.');
