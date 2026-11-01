import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
const vite=fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url));
const run=(file,args,env)=>new Promise((ok,no)=>{const p=spawn(process.execPath,[file,...args],{env,stdio:'inherit',windowsHide:true});p.on('error',no);p.on('exit',code=>code===0?ok():no(Error(`${file} failed (${code})`)));});
for(const mode of process.argv.includes('--public-only')?['public']:['fixtures','public']){
 const env={...process.env,VITE_APP_ENVIRONMENT:mode,VITE_SUPABASE_URL:'https://qa-fixtures.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_isolated_quality_fixture',VITE_ENABLE_AI_SCREENING:'false',VITE_ENABLE_EMAIL_NOTIFICATIONS:'false',VITE_ENABLE_PERSONAL_DATA_COLLECTION:'false'};
 const outDir=`readiness-build.local/${mode}`,port=mode==='public'?5191:5192;env.UI_TEST_URL=`http://127.0.0.1:${port}`;
 await run(vite,['build','--outDir',outDir],env);
 const server=spawn(process.execPath,[vite,'preview','--outDir',outDir,'--host','127.0.0.1','--port',String(port),'--strictPort'],{env,stdio:'ignore',windowsHide:true});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(env.UI_TEST_URL)).ok){ready=true;break;}}catch{}await setTimeout(200);}if(!ready)throw Error('Readiness preview failed');
  for(const suite of mode==='public'?['privacy-pause-browser.mjs']:['readiness-browser.mjs','i18n-browser.mjs'])await run(fileURLToPath(new URL(suite,import.meta.url)),[],env);
 }finally{server.kill();}
}
