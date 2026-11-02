import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const run=(file,args=[])=>{
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url)),...args],{stdio:'inherit',windowsHide:true});
  if(result.error || result.status!==0)process.exit(result.status || 1);
};
if(process.env.PROTECTED_HOSTED_TEST==='true')run('./protected-provider-proof.mjs');
run('../../node_modules/vite/bin/vite.js',['build']);
