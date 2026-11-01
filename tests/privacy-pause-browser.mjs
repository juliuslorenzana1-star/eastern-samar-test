// Only local assets and intercepted fictional responses; no provider requests.
import assert from 'node:assert/strict';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { loadEnv } from 'vite';
import { createDemoState, demoSession, installDemoTransport } from '../scripts/presentation/fixtures.mjs';
const base=process.env.UI_TEST_URL||'http://127.0.0.1:5183';const provider=new URL(loadEnv('production',process.cwd(),'VITE_').VITE_SUPABASE_URL).origin;
const key=`sb-${new URL(provider).hostname.split('.')[0]}-auth-token`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});const results=[];
await mkdir('test-results.local/readiness',{recursive:true});
try {
  for(const {width,theme} of [320,768,1440].flatMap(width=>['light','dark'].map(theme=>({width,theme})))){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await context.addInitScript(theme=>localStorage.setItem('escam.theme-mode',theme),theme);const state=createDemoState();await installDemoTransport(context,state,new URL(base).origin,provider);const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.collection-pause-banner').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('.header-profile').click();await page.locator('.resident-profile .primary-button').click();const auth=page.locator('.auth-modal');await auth.locator('input[type=email]').fill('fictional@example.invalid');await auth.locator('input[type=password]').fill('fictional-test-password');await auth.locator('button[type=submit]').click();assert.match(await auth.locator('.form-error').textContent(),/submissions are paused/);await auth.getByRole('button',{name:'Close account dialog'}).click();
    await page.evaluate(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));},{key,session:demoSession()});await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:demoSession()});await page.goto(base+'/#map');await page.reload();await page.locator('.header-profile').click();await page.waitForFunction(()=>document.querySelector('.resident-profile h1')?.textContent==='Demo Resident');await page.locator('.brand').click();await page.locator('.hero-actions .primary-button').click();const form=page.locator('.report-modal');await form.locator('input[name=title]').fill('Fictional blocked submission');await form.locator('textarea[name=description]').fill('This fictional submission must never leave the browser.');await form.getByRole('button',{name:'Next →',exact:true}).click();await form.locator('select[name=municipality]').selectOption('Borongan City');await form.getByRole('button',{name:'Next →',exact:true}).click();await form.locator('button[type=submit]').click();assert.match(await form.locator('.form-error').textContent(),/submissions are paused/);
    assert.ok(!state.writes.some(write=>/\/auth\/|\/reports$|\/storage\/|join_volunteer/.test(write.path)));assert.deepEqual(errors,[]);
    // Structural keyboard/name checks supplement the existing focus-trap suites.
    assert.equal(await page.locator('button:visible').evaluateAll(buttons=>buttons.filter(button=>!button.textContent.trim()&&!button.getAttribute('aria-label')&&!button.getAttribute('title')).length),0);
    if(process.env.AXE_PATH){await page.addScriptTag({content:await readFile(process.env.AXE_PATH,'utf8')});const audit=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}}));results.push({width,theme,axe:audit.violations.map(({id,impact,nodes})=>({id,impact,count:nodes.length,targets:nodes.map(node=>node.target)}))});}
    await page.screenshot({path:`test-results.local/readiness/privacy-paused-${width}.png`});results.push({width,theme,overflow:false,accountRequestBlocked:true,reportWriteBlocked:true,pageErrors:errors});await context.close();
  }
  await writeFile('test-results.local/readiness/privacy-pause.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));assert.ok(results.every(item=>!item.axe||item.axe.length===0));
}catch(error){for(const context of browser.contexts())for(const page of context.pages()){console.error('Fixture profile:',await page.locator('.resident-profile h1').allTextContents());await page.screenshot({path:'test-results.local/readiness/privacy-failure.png'});}throw error;}finally{await browser.close();}
