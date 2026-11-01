// Genuine Supabase/Auth/Storage + UI workflow test. No response fixtures or token injection.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { stagingEnvironment,checkClosedSignup } from './environment.mjs';
const env=stagingEnvironment();await checkClosedSignup(env);
const roles=['RESIDENT','OBSERVER','MODERATOR','OUTSIDER'];
for(const role of roles)for(const suffix of ['EMAIL','PASSWORD'])if(!env[`STAGING_${role}_${suffix}`])throw Error(`Missing designated STAGING_${role}_${suffix}; no test writes attempted.`);
const clients={};
for(const role of roles){
  const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.auth.signInWithPassword({email:env[`STAGING_${role}_EMAIL`],password:env[`STAGING_${role}_PASSWORD`]});
  assert.ok(!error,`Designated ${role.toLowerCase()} login failed`);
  const {data,error:accessError}=await client.rpc('staging_access');assert.ok(!accessError,'Staging access marker missing');
  assert.equal(data.project_ref,env.VITE_STAGING_PROJECT_REF);assert.equal(data.authorized,role!=='OUTSIDER');clients[role]=client;
}
for(const [name,value]of Object.entries(env))if(name.startsWith('VITE_'))process.env[name]=value;
const server=await createServer({mode:'staging',server:{host:'127.0.0.1',port:5187,strictPort:true}});await server.listen();
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const base='http://127.0.0.1:5187',runId=new Date().toISOString().replace(/[^0-9]/g,''),title=`[TEST ${runId}] Coastal sample concern`,activityTitle=`[TEST ${runId}] Controlled volunteer activity`;
const contexts=[];let unexpectedFunctions=0;
async function login(role){
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});contexts.push(context);
  await context.addInitScript(()=>localStorage.setItem('escam.language','en'));
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===env.VITE_SUPABASE_URL){if(url.pathname.startsWith('/functions/')){unexpectedFunctions++;return route.abort();}return route.continue();}if(url.origin===base)return route.continue();return route.abort();});
  const page=await context.newPage();await page.goto(base);await page.locator('.testing-environment-label').waitFor();
  await page.locator('.header-profile').click();await page.locator('.resident-profile .primary-button').click();const auth=page.locator('.auth-modal');
  await auth.locator('input[type=email]').fill(env[`STAGING_${role}_EMAIL`]);await auth.locator('input[type=password]').fill(env[`STAGING_${role}_PASSWORD`]);await auth.locator('button[type=submit]').click();await auth.waitFor({state:'detached'});
  await page.locator('.brand').click();return page;
}
try{
  const resident=await login('RESIDENT'),observer=await login('OBSERVER'),moderator=await login('MODERATOR');
  const imagePage=await browser.newPage({viewport:{width:640,height:360}});await imagePage.setContent('<body style="font:26px sans-serif;background:#e4f0e9;padding:40px"><h1>UPLOAD CHECK</h1><p>Non-personal sample image for restricted testing.</p></body>');const sample=await imagePage.screenshot();await imagePage.close();
  await resident.locator('.hero-actions .primary-button').click();const form=resident.locator('.report-modal').filter({has:resident.locator('#report-form-title')});
  await form.locator('input[name=title]').fill(title);await form.locator('textarea[name=description]').fill('Controlled functional test using fictional conditions and no personal information.');await form.locator('select[name=category]').selectOption('environment');
  await form.locator('input[type=file]').setInputFiles({name:'non-personal-sample.png',mimeType:'image/png',buffer:sample});await form.getByRole('button',{name:'Next →',exact:true}).click();
  await form.locator('select[name=municipality]').selectOption('Borongan City');await form.locator('input[name=barangay]').fill('Controlled test area');await form.getByRole('button',{name:'Choose point',exact:true}).click();
  const map=resident.locator('.leaflet-map:visible').last();const box=await map.boundingBox();await map.click({position:{x:box.width/2,y:box.height/2}});await form.waitFor();await form.getByRole('button',{name:'Next →',exact:true}).click();await form.locator('button[type=submit]').click();await resident.locator('.receipt-dialog').waitFor();
  const {data:own,error:ownError}=await clients.RESIDENT.from('reports').select('id,status,is_public').eq('title',title).single();assert.ok(!ownError);assert.equal(own.status,'pending_review');assert.equal(own.is_public,false);
  const {data:before}=await clients.OBSERVER.from('reports').select('id').eq('id',own.id);assert.equal(before?.length,0);
  const {error:unauthorized}=await clients.RESIDENT.rpc('moderate_report',{target_report_id:own.id,next_status:'verified',next_priority:'normal',internal_note:null,resident_note:null});assert.ok(unauthorized);
  const {data:evidence,error:evidenceError}=await clients.RESIDENT.from('report_evidence').select('object_path,byte_size').eq('report_id',own.id).single();assert.ok(!evidenceError);assert.equal(Number(evidence.byte_size),sample.length);
  const signed=await clients.RESIDENT.storage.from('report-evidence').createSignedUrl(evidence.object_path,60);assert.ok(!signed.error);const image=await fetch(signed.data.signedUrl);assert.ok(image.ok);assert.equal((await image.arrayBuffer()).byteLength,sample.length);
  const deniedImage=await clients.OBSERVER.storage.from('report-evidence').createSignedUrl(evidence.object_path,60);assert.ok(deniedImage.error,'Other resident must not access private evidence');
  const {error:outsiderRpc}=await clients.OUTSIDER.rpc('my_reports');assert.ok(outsiderRpc);const {data:outsiderRows}=await clients.OUTSIDER.from('reports').select('id');assert.equal(outsiderRows?.length||0,0);
  await moderator.goto(base+'/operations/');await moderator.locator('.ops-nav').waitFor();await moderator.locator('.ops-nav nav button').nth(2).click();await moderator.locator('.review-table tbody tr').filter({hasText:title}).locator('.review-report-title').click();
  const review=moderator.locator('.review-modal');await review.locator('form select').first().selectOption('verified');await review.locator('textarea').first().fill('Controlled test review completed.');await review.locator('textarea').last().fill('Non-personal sample reviewed in restricted staging.');await review.locator('button[type=submit]').click();await review.waitFor({state:'detached'});
  const {data:published}=await clients.OBSERVER.from('reports').select('id,status,is_public').eq('id',own.id).single();assert.equal(published.status,'verified');assert.equal(published.is_public,true);
  const anonymous=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:publicRows}=await anonymous.from('reports').select('id').eq('id',own.id);assert.equal(publicRows?.length||0,0,'Test reports must not be distributed anonymously');
  const {error:publicTimeline}=await anonymous.rpc('report_progress',{target_report_id:own.id});assert.ok(publicTimeline,'Anonymous timeline RPC must be denied');
  await observer.reload();await observer.locator('.report-title').filter({hasText:title}).waitFor();await observer.locator('.report-title').filter({hasText:title}).click();await observer.locator('.report-progress ol li').first().waitFor();
  const create=moderator.locator('.volunteer-create-form');await create.locator('select').first().selectOption('standalone');await create.getByLabel('Municipality',{exact:true}).selectOption('Borongan City');await create.getByPlaceholder('What help is needed?').fill(activityTitle);await create.getByPlaceholder('Describe the activity and how volunteers can help.').fill('Controlled testing activity using designated accounts only.');await create.locator('input[type=datetime-local]').first().fill(new Date(Date.now()+86400000*7).toISOString().slice(0,16));await create.locator('input[type=number]').last().fill('1');await create.locator('button[type=submit]').click();await create.locator('.form-success').waitFor();
  const {data:activity,error:activityError}=await clients.RESIDENT.from('volunteer_opportunities').select('id').eq('title',activityTitle).single();assert.ok(!activityError);
  await resident.goto(base);await resident.reload();await resident.locator('.desktop-navigation button').nth(2).click();const card=resident.locator('.volunteer-opportunity').filter({hasText:activityTitle});await card.locator('.volunteer-card-actions .outline-button').click();const modal=resident.locator('.volunteer-modal');await modal.locator('.volunteer-modal-actions .primary-button').click();assert.equal(await modal.locator('input[type=checkbox]').isChecked(),false);await modal.locator('input[type=checkbox]').check();await modal.locator('.volunteer-modal-actions .primary-button').click();await resident.locator('.volunteer-success-content').waitFor();
  const {data:registration,error:registrationError}=await clients.RESIDENT.from('volunteer_registrations').select('id,status').eq('opportunity_id',activity.id).single();assert.ok(!registrationError);assert.equal(registration.status,'registered');
  for(const width of [320,390,768,1440]){await resident.setViewportSize({width,height:1000});assert.ok(await resident.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  assert.equal(unexpectedFunctions,0);assert.equal(await resident.locator('#demo-safety-banner').count(),0);
  await mkdir('test-results.local/staging',{recursive:true});await writeFile('test-results.local/staging/real-e2e.json',JSON.stringify({projectRef:env.VITE_STAGING_PROJECT_REF,runId,reportId:own.id,activityId:activity.id,realAuth:true,realStorage:true,moderationPersisted:true,publicationRestricted:true,consentAndRegistration:true,externalEmailTested:false,aiCalled:false,viewports:[320,390,768,1440]},null,2));
  console.log('PASS real staging workflows. Email/AI were not enabled or claimed delivered.');
}finally{for(const context of contexts)await context.close();await browser.close();await server.close();for(const client of Object.values(clients))await client.auth.signOut({scope:'local'});}
