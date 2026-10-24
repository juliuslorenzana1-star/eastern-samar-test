import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
const base=process.env.UI_TEST_URL || 'http://127.0.0.1:5179/';
const server=process.env.UI_TEST_URL ? null : spawn(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'preview','--host','127.0.0.1','--port','5179','--strictPort'],{stdio:'inherit',windowsHide:true});
try {
  let ready=false;
  for(let attempt=0;attempt<100;attempt++) {
    try {if((await fetch(base)).ok){ready=true;break;}}catch{ /* Preview is starting. */ }
    await setTimeout(200);
  }
  if(!ready)throw new Error('Built preview server did not start. Run npm run build first.');
  const suites=process.argv.includes('--live-only') ? ['public-live-browser.mjs'] : process.argv.includes('--focused') ? ['mobile-recognition-browser.mjs'] : ['interface-browser.mjs','onboarding-browser.mjs','mobile-recognition-browser.mjs'];
  if(process.argv.includes('--live'))suites.push('public-live-browser.mjs');
  for(const suite of suites) await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL(suite,import.meta.url))],{env:{...process.env,UI_TEST_URL:base},stdio:'inherit',windowsHide:true});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${suite} failed (${code})`)));
  });
}finally{server?.kill();}
