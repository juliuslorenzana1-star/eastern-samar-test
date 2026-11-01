// Collection-enabled artifacts are local QA only. Every browser suite intercepts providers.
import { build, preview } from 'vite';
import { spawn } from 'node:child_process';
process.env.VITE_ENABLE_PERSONAL_DATA_COLLECTION='true';
process.env.VITE_APP_ENVIRONMENT='fixtures';
process.env.VITE_SUPABASE_URL='https://qa-fixtures.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_isolated_qa_only';
await build({build:{outDir:'qa-dist.local',emptyOutDir:true},logLevel:'warn'});
const server=await preview({build:{outDir:'qa-dist.local'},preview:{host:'127.0.0.1',port:5185,strictPort:true},logLevel:'warn'});
const run=file=>new Promise((ok,no)=>{const child=spawn(process.execPath,[file],{windowsHide:true,stdio:'inherit',env:{...process.env,UI_TEST_URL:'http://127.0.0.1:5185/'}});child.on('error',no);child.on('exit',code=>code===0?ok():no(Error(file+' failed')));});
try{await run('tests/run-browser.mjs');await run('tests/i18n-browser.mjs');}finally{await new Promise(resolve=>server.httpServer.close(resolve));}
