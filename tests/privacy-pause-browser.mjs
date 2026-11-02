// Public-mode browser checks. All provider traffic is intercepted, never real.
import assert from 'node:assert/strict';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {loadEnv} from 'vite';
import {createDemoState,demoSession,installDemoTransport} from '../scripts/presentation/fixtures.mjs';
const base=process.env.UI_TEST_URL||'http://127.0.0.1:5183';const provider=new URL(loadEnv('production',process.cwd(),'VITE_').VITE_SUPABASE_URL).origin;
const key=`sb-${new URL(provider).hostname.split('.')[0]}-auth-token`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});const results=[];
await mkdir('test-results.local/readiness',{recursive:true});
try{
 for(const {width,theme} of [320,768,1440].flatMap(width=>['light','dark'].map(theme=>({width,theme})))){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await context.addInitScript(theme=>localStorage.setItem('escam.theme-mode',theme),theme);const state=createDemoState();await installDemoTransport(context,state,new URL(base).origin,provider);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);const status=page.locator('.collection-status');await status.waitFor();assert.equal(await status.getAttribute('open'),null);assert.equal(await page.locator('.collection-pause-banner').count(),0);await status.locator('summary').click();assert.match(await status.innerText(),/verified privacy contact/);await status.locator('summary').click();
  await page.locator('.header-profile').click();await page.locator('.resident-profile .primary-button').click();const auth=page.locator('.auth-modal');await auth.waitFor();assert.equal(await auth.locator('input').count(),0);assert.match(await auth.innerText(),/submissions are temporarily unavailable/);await auth.getByRole('button',{name:'Close account dialog'}).click();
  await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:demoSession()});await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:demoSession()});await page.goto(base+'/#map');await page.reload();await page.locator('.hero-actions .primary-button').click();await auth.waitFor();assert.equal(await auth.locator('input,textarea').count(),0);assert.equal(await page.locator('#report-form-title').count(),0);assert.deepEqual(state.writes.filter(item=>!/^\/rest\/v1\/rpc\/(my_reports|get_volunteer_signup_counts|get_volunteer_community_totals|platform_statistics|my_volunteer_summary|report_progress)$/.test(item.path)),[]);assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(process.env.AXE_PATH){await page.addScriptTag({content:await readFile(process.env.AXE_PATH,'utf8')});const audit=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}}));assert.deepEqual(audit.violations,[]);}
  await page.screenshot({path:`test-results.local/readiness/public-gate-${width}-${theme}.png`});results.push({width,theme,compactStatus:true,accountFieldsAbsent:true,reportFieldsAbsent:true,providerWrites:state.writes.filter(item=>!item.path.includes('/rpc/')).length,pageErrors:errors});await context.close();
 }
 await writeFile('test-results.local/readiness/privacy-pause.json',JSON.stringify(results,null,2));console.log('PASS public privacy gate: no personal-data fields or provider writes in six viewport/theme cases.');
}finally{await browser.close()}
