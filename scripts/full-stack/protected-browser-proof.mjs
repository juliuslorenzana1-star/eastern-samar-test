// Approved protected Preview only. Uses fictional users and never publishes QA reports.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
const cfg=JSON.parse(await readFile('test-results.local/protected-hosted-secret.json','utf8'));
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
const contexts=[];const result={preview:cfg.base,run:cfg.run,errors:[],unexpectedFunctions:0};let publicHeaders;
async function open(width){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});contexts.push(context);
  await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url());
    if(u.pathname.startsWith('/functions/')){result.unexpectedFunctions++;return route.abort();}
    if(u.origin===cfg.base || u.hostname==='xoitncotbgobcsdmvyjb.supabase.co')return route.continue();
    return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname==='xoitncotbgobcsdmvyjb.supabase.co')publicHeaders=r.headers();});
  await page.goto(cfg.base+'/?_vercel_share='+encodeURIComponent(cfg.share),{waitUntil:'domcontentloaded'});
  await page.locator('.leaflet-map').waitFor();await page.goto(cfg.base,{waitUntil:'domcontentloaded'});await page.locator('.testing-environment-label').waitFor();
  return page;
}
try{
  const visitor=await open(390);await visitor.locator('.topbar .language-selector select').selectOption('war');await visitor.waitForFunction(()=>document.documentElement.lang==='war');
  await visitor.locator('.hero-actions .primary-button').click();const form=visitor.locator('.report-modal').filter({has:visitor.locator('#report-form-title')});await form.waitFor();
  assert.equal(await form.locator('.report-identity select').inputValue(),'anonymous');
  const title=`PROTECTED BROWSER TEST ${cfg.run}`;
  await form.locator('input[name=title]').fill(title);await form.locator('textarea[name=description]').fill('Fictional private hosted smoke test. Do not approve or publish.');
  const photo=await sharp({create:{width:16,height:16,channels:3,background:'blue'}}).png().withMetadata({exif:{IFD0:{Artist:'Fictional metadata'}}}).toBuffer();
  await form.locator('input[type=file]').setInputFiles({name:'fictional-sample.png',mimeType:'image/png',buffer:photo});await form.locator('.modal-foot-actions .primary-button').click();await form.locator('select[name=municipality]').selectOption('Guiuan');await form.locator('.modal-foot-actions .primary-button').click();
  const response=visitor.waitForResponse(r=>new URL(r.url()).pathname==='/api/anonymous' && r.request().method()==='POST');await form.locator('.modal-foot-actions .primary-button').click();const saved=await(await response).json();
  assert.ok(saved.id);assert.equal(saved.photoSaved,true,JSON.stringify({photoSaved:saved.photoSaved,error:saved.error}));
  const receipt=visitor.locator('.receipt-dialog');await receipt.waitFor();const credential=await receipt.locator('textarea').inputValue();assert.match(credential,/^[A-Za-z0-9_-]{43}$/);result.reportId=saved.id;
  await receipt.locator('.primary-button').click();const tracking=visitor.locator('.report-modal').filter({has:visitor.locator('#tracking-title')});await tracking.locator('input[type=password]').fill(credential);await tracking.locator('button.primary-button').click();await tracking.locator('section[aria-live=polite] h3').waitFor();assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const moderator=await open(1440);await moderator.locator('.header-profile').click();await moderator.locator('.resident-profile .primary-button').click();const auth=moderator.locator('.auth-modal');await auth.locator('input[type=email]').fill(`protected-moderator-${cfg.run}@example.invalid`);await auth.locator('input[type=password]').fill(cfg.password);await auth.locator('button[type=submit]').click();await auth.waitFor({state:'detached'});
  await moderator.goto(cfg.base+'/operations/');await moderator.locator('.ops-nav').waitFor();await moderator.locator('.ops-nav nav button').nth(2).click();await moderator.locator('.review-table tbody tr').filter({hasText:title}).locator('.review-report-title').click();
  const review=moderator.locator('.review-modal');await review.locator('.evidence-gallery img').waitFor();await review.locator('form select').first().selectOption('rejected');await review.locator('form select').nth(1).selectOption('high');await review.locator('textarea').first().fill('Protected fictional test completed. Do not publish.');await review.locator('textarea').last().fill('Private fictional smoke-test note.');await review.locator('button[type=submit]').click();await review.waitFor({state:'detached'});
  const tracked=await visitor.request.post(cfg.base+'/api/anonymous',{headers:{Origin:cfg.base,'Content-Type':'application/json','X-Report-Operation':'track'},data:{trackingCredential:credential}});assert.equal(tracked.status(),200);const status=(await tracked.json()).report;assert.equal(status.status,'rejected');assert.equal(status.priority,'high');assert.ok(!JSON.stringify(status).includes('Private fictional smoke-test note'));
  const headers={apikey:publicHeaders.apikey,...(publicHeaders.authorization?{Authorization:publicHeaders.authorization}:{})};
  const visible=await visitor.request.get(`https://xoitncotbgobcsdmvyjb.supabase.co/rest/v1/public_report_feed?select=id&id=eq.${saved.id}`,{headers});assert.equal(visible.status(),200);assert.deepEqual(await visible.json(),[]);
  assert.equal(result.unexpectedFunctions,0);assert.deepEqual(result.errors,[]);
  Object.assign(result,{protectedAccess:true,realAnonymousEndpoint:true,photoSaved:true,realModeratorBrowserLogin:true,privateEvidenceVisibleToModerator:true,rejectionPersisted:true,trackingPersisted:true,noPublicTestDistribution:true,warayMobile:true});
  await writeFile('test-results.local/protected-browser-proof.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){let message=String(error.message).replaceAll(cfg.share,'[redacted]').replaceAll(cfg.password,'[redacted]');console.error('PROTECTED_BROWSER_FAILURE '+message.replace(/[A-Za-z0-9_-]{48,}/g,'[redacted]'));process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
