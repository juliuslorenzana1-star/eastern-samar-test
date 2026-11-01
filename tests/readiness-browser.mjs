// Visual/interaction regression only: intercepted fictional data, no backend
// writes or simulated submission assertions. Real database tests run separately.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadEnv} from 'vite';
import {createDemoState,demoSession,installDemoTransport} from '../scripts/presentation/fixtures.mjs';
const base=process.env.UI_TEST_URL||'http://127.0.0.1:5188',env=loadEnv('production',process.cwd(),'VITE_'),provider=env.VITE_SUPABASE_URL;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const results=[];await mkdir('test-results.local/readiness/ui',{recursive:true});
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
async function fits(page,dialog){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');const overflow=await dialog.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,items:[...el.querySelectorAll('*')].filter(c=>c.getBoundingClientRect().right>el.getBoundingClientRect().right).map(c=>({tag:c.tagName,cls:c.className,width:c.getBoundingClientRect().width,min:getComputedStyle(c).minWidth,display:getComputedStyle(c).display,box:getComputedStyle(c).boxSizing}))}));if(overflow.scroll>overflow.client+1)console.log(JSON.stringify(overflow));assert.ok(overflow.scroll<=overflow.client+1,'dialog overflow');}
try{
 for(const width of (process.env.UI_AUDIT_WIDTHS?process.env.UI_AUDIT_WIDTHS.split(',').map(Number):[320,375,390,430,768,1024,1440]))for(const theme of ['light','dark']){
  const height=width<768?844:1000,context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),state=createDemoState();
  await installDemoTransport(context,state,new URL(base).origin,provider);
  await context.addInitScript(({key,session,theme})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('escam.theme-mode',theme);localStorage.setItem('escam.language','en');},{key:`sb-${new URL(provider).hostname.split('.')[0]}-auth-token`,session:demoSession(),theme});
  await context.addInitScript(()=>{window.__readinessCLS=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__readinessCLS+=e.value;}).observe({type:'layout-shift',buffered:true});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.leaflet-map').waitFor();
  const performanceSample=await page.evaluate(()=>({context:'local intercepted data; not a production performance benchmark',mapVisibleAtMs:Math.round(performance.now()),firstContentfulPaintMs:performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')?.startTime??null,initialLayoutShift:window.__readinessCLS}));
  const nav=page.locator('.topbar .language-selector select');assert.deepEqual(await nav.locator('option').allTextContents(),['English','Filipino','Waray-Waray — Boronganon']);
  const navStyle=await nav.evaluate(el=>{const s=getComputedStyle(el),wrapper=getComputedStyle(el.parentElement),r=el.getBoundingClientRect();return{width:r.width,height:r.height,border:s.borderTopWidth,wrapperBorder:wrapper.borderTopWidth,wrapperPadding:wrapper.padding,shadow:s.boxShadow};});assert.ok(navStyle.width<=84&&navStyle.height>=44&&navStyle.height<=48);assert.equal(navStyle.border,'1px');assert.equal(navStyle.wrapperBorder,'0px');assert.equal(navStyle.shadow,'none');
  await page.screenshot({path:`test-results.local/readiness/ui/page-${width}-${theme}.png`,fullPage:false});
  const opener=page.locator('.hero-actions .primary-button');await opener.click();const dialog=page.locator('.report-modal').filter({has:page.locator('#report-form-title')});await dialog.waitFor();
  assert.equal(await dialog.locator('.modal-head .language-control').count(),0);
  assert.equal(await dialog.locator('.report-language-settings').getAttribute('open'),null);
  const close=dialog.locator('.modal-head .icon-button'),box=await close.boundingBox();assert.ok(box.width>=44&&box.height>=44);assert.ok(!overlaps(await dialog.locator('#report-form-title').boundingBox(),box));
  assert.equal(await dialog.locator('.report-steps li').count(),3);assert.equal(await dialog.locator('.report-steps [aria-current=step] strong').textContent(),'Details');
  await dialog.locator('input[name=title]').fill('Fictional readiness concern');await dialog.locator('textarea[name=description]').fill('Non-personal sample text preserved across language and map changes.');
  await dialog.locator('input[type=file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const g=c.getContext('2d');g.fillStyle='#0b3945';g.fillRect(0,0,320,180);g.fillStyle='#187c6c';g.fillRect(0,110,320,70);g.fillStyle='#fff';g.font='16px sans-serif';g.textAlign='center';g.fillText('FICTIONAL TEST IMAGE',160,90);return c.toDataURL('image/png').split(',')[1];}),'base64')});await dialog.locator('.evidence-preview').waitFor();
  const languageSettings=dialog.locator('.report-language-settings');
  for(const code of ['war','fil','en']){
   await languageSettings.locator('summary').click();await languageSettings.locator('select').selectOption(code);await page.waitForFunction(code=>document.documentElement.lang===code,code);
   assert.equal(await dialog.locator('input[name=title]').inputValue(),'Fictional readiness concern');assert.equal(await dialog.locator('input[type=file]').evaluate(el=>el.files[0].name),'sample.png');
   await languageSettings.locator('summary').click();await fits(page,dialog);
  }
  await dialog.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:`test-results.local/readiness/ui/report-${width}-${theme}.png`});
  await dialog.locator('button[type=button]').filter({hasText:'Next →'}).click();await dialog.locator('select[name=municipality]').selectOption('Borongan City');await dialog.locator('input[name=barangay]').fill('Fictional sample area');
  await dialog.getByRole('button',{name:'Choose point',exact:true}).click();await page.locator('.map-stage').click({position:{x:100,y:140}});await dialog.waitFor();assert.equal(await dialog.locator('input[name=barangay]').inputValue(),'Fictional sample area');assert.equal(await dialog.locator('input[name=title]').inputValue(),'Fictional readiness concern');await fits(page,dialog);await dialog.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:`test-results.local/readiness/ui/location-${width}-${theme}.png`});
  await dialog.locator('button[type=button]').filter({hasText:'Next →'}).click();await dialog.locator('.report-review').waitFor();assert.match(await dialog.locator('.report-review').innerText(),/Fictional readiness concern/);assert.equal(await dialog.locator('input[type=file]').evaluate(el=>el.files[0].name),'sample.png');
  await dialog.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:`test-results.local/readiness/ui/review-${width}-${theme}.png`});
  // Dynamic details controls participate in the trap; the page stays locked.
  await languageSettings.locator('summary').click();const select=languageSettings.locator('select');await select.focus();await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));await close.focus();await page.keyboard.press('Shift+Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await opener.evaluate(el=>el===document.activeElement),true);assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
  assert.deepEqual(errors,[]);assert.deepEqual(state.writes.filter(item=>!/^\/rest\/v1\/rpc\/(my_reports|get_volunteer_signup_counts|get_volunteer_community_totals|platform_statistics|my_volunteer_summary|report_progress)$/.test(item.path)),[]);results.push({width,theme,performanceSample,languages:['en','fil','war'],singleSelectorBorder:true,touchTargets:true,modalHeadingCollision:false,allSteps:true,formAndImagePreserved:true,mapSelectionPreserved:true,focusTrapAndRestoration:true,pageErrors:errors});console.log(`PASS UI ${width} ${theme}`);await context.close();
 }
 await writeFile(`test-results.local/readiness/ui/results${process.env.UI_AUDIT_WIDTHS?'-steps':''}.json`,JSON.stringify({testType:'intercepted visual/interaction regression; not real Supabase Auth/Storage',cases:results},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:'test-results.local/readiness/ui/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
