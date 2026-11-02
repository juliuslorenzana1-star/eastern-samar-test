// Real GoTrue/Auth, PostgREST, PostgreSQL, Storage API and browser. No fixtures.
// Only the dedicated unlinked loopback Docker stack is accepted.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {createServer as createViteServer} from 'vite';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {credentials,sql} from './local-stack.mjs';
import anonymous from '../../api/anonymous.js';

const settings=credentials(),base='http://127.0.0.1:5196',checks=[];
const client=key=>createClient(settings.url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=client(settings.service),visitor=client(settings.anon);
function passed(name){checks.push(name);console.log('PASS '+name);}
async function data(result,label){const {data,error}=await result;if(error){const failure=Error(label);failure.stage=label;failure.providerCode=error.code || error.status;failure.detail=error.message;throw failure;}return data;}
const sha=value=>createHash('sha256').update(value).digest('hex');
const runId=Date.now();
Object.assign(process.env,{ANON_ENVIRONMENT:'isolated',ANON_REPORTING_ENABLED:'true',ANON_ALLOWED_ORIGIN:base,ANON_SOURCE_HMAC_KEY:randomBytes(32).toString('hex'),SUPABASE_URL:settings.url,SUPABASE_SERVICE_ROLE_KEY:settings.service,VITE_APP_ENVIRONMENT:'staging',VITE_STAGING_PROJECT_REF:'local-docker-proof',VITE_SUPABASE_URL:settings.url,VITE_SUPABASE_PUBLISHABLE_KEY:settings.anon,VITE_ENABLE_ANONYMOUS_REPORTING:'true',VITE_ENABLE_PERSONAL_DATA_COLLECTION:'true',VITE_ENABLE_AI_SCREENING:'false',VITE_ENABLE_EMAIL_NOTIFICATIONS:'false'});
const api=createServer(anonymous);await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
const vite=await createViteServer({server:{host:'127.0.0.1',port:5196,strictPort:true,proxy:{'/api/anonymous':`http://127.0.0.1:${api.address().port}`}}});await vite.listen();
let browser;const contexts=[];
async function post(operation,body){const response=await fetch(base+'/api/anonymous',{method:'POST',headers:{origin:base,'content-type':'application/json','x-report-operation':operation},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
const sample={title:`Fictional Docker concern ${runId}`,description:'Non-personal concern for an isolated full-stack integration test.',category:'environment',municipality:'Guiuan',barangay:'',priority:'normal',location:{lat:11.02,lng:125.72}};
const users={};
try{
  const authSettings=await(await fetch(settings.url+'/auth/v1/settings',{headers:{apikey:settings.anon}})).json();
  assert.equal(authSettings.disable_signup,true);assert.notEqual(authSettings.external?.anonymous_users,true);
  const refusedSignup=await visitor.auth.signUp({email:`blocked-${runId}@example.invalid`,password:randomBytes(32).toString('hex')});assert.ok(refusedSignup.error);
  passed('real Auth disables public signup and anonymous Auth identities');
  const before=JSON.parse(sql("select json_build_object('users',(select count(*) from auth.users),'reports',(select count(*) from reports))"));
  const photo=await sharp({create:{width:20,height:20,channels:3,background:'green'}}).png().withMetadata({exif:{IFD0:{Artist:'Fictional metadata to strip'}}}).toBuffer();
  const secret=randomBytes(32).toString('base64url');
  const payload={trackingCredential:secret,report:sample,photo:photo.toString('base64')};
  const saved=await post('submit',payload);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.photoSaved,true);
  const id=saved.body.id;assert.match(id,/^[a-f0-9-]{36}$/);
  const actual=await data(admin.from('reports').select('id,status,is_public,reporter_id').eq('id',id).single(),'persisted report');
  assert.equal(actual.reporter_id,null);assert.equal(actual.status,'pending_review');assert.equal(actual.is_public,false);
  assert.equal(Number(sql('select count(*) from auth.users')),Number(before.users));
  const retry=await post('submit',payload);assert.equal(retry.status,200);assert.equal(retry.body.id,id);assert.equal(retry.body.photoSaved,true);
  const tracked=await post('track',{trackingCredential:secret});assert.equal(tracked.status,200);assert.equal(tracked.body.report.status,'pending_review');
  assert.equal((await post('track',{trackingCredential:randomBytes(32).toString('base64url')})).status,404);
  passed('actual application endpoint persists anonymous reports and idempotent retries without Auth accounts; PostgREST RPC cache resolves');
  const confidentialKey=randomBytes(32).toString('base64url');
  const identified=await post('submit',{trackingCredential:confidentialKey,report:{...sample,title:`Confidential Docker concern ${runId}`,contact:{email:'fictional@example.invalid'}}});assert.equal(identified.status,200);
  assert.ok(!JSON.stringify((await post('track',{trackingCredential:confidentialKey})).body).includes('fictional@example.invalid'));
  passed('optional contact persists privately and is absent from tracking responses');
  const evidence=await data(admin.from('report_evidence').select('object_path,byte_size,uploaded_by').eq('report_id',id).single(),'photo metadata');
  assert.equal(evidence.uploaded_by,null);assert.ok(evidence.byte_size>0);
  const bucket=await data(admin.storage.getBucket('report-evidence'),'private bucket');assert.equal(bucket.public,false);
  const original=await data(admin.storage.from('report-evidence').download(evidence.object_path),'actual stored bytes');
  const metadata=await sharp(Buffer.from(await original.arrayBuffer())).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);
  assert.ok((await visitor.storage.from('report-evidence').download(evidence.object_path)).error);
  assert.ok((await visitor.from('reports').insert(sample)).error);
  assert.ok((await visitor.rpc('track_visitor_report',{tracking_hash:sha(secret)})).error);
  passed('real Storage API stores sanitized bytes; anon direct writes/downloads and protected RPC execution denied');
  for(const role of ['resident','observer','moderator']){
    const email=`${role}-${runId}@example.invalid`,password='Safe1!'+randomBytes(24).toString('hex');
    const created=await data(admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:`Fictional ${role}`}}),'create isolated Auth user');
    assert.match(created.user.id,/^[a-f0-9-]{36}$/);users[role]={email,password,id:created.user.id,client:client(settings.anon)};
    await data(users[role].client.auth.signInWithPassword({email,password}),'real password login');
  }
  sql(`update public.profiles set role='moderator' where id='${users.moderator.id}';
    create table private.local_stack_testers(user_id uuid primary key references auth.users(id));
    alter table private.local_stack_testers enable row level security;
    revoke all on private.local_stack_testers from public,anon,authenticated,service_role;
    insert into private.local_stack_testers values('${users.resident.id}'),('${users.observer.id}'),('${users.moderator.id}');
    create function public.staging_access() returns jsonb language sql stable security definer set search_path='' as $$
      select jsonb_build_object('authorized',exists(select 1 from private.local_stack_testers where user_id=auth.uid()),'project_ref','local-docker-proof'); $$;
    revoke all on function public.staging_access() from public,anon;grant execute on function public.staging_access() to authenticated;notify pgrst,'reload schema';`);
  const args={target_report_id:id,next_status:'approved',next_priority:'normal',internal_note:'Private fictional note',resident_note:'Fictional resident-facing update'};
  assert.ok((await users.resident.client.rpc('moderate_report',args)).error);
  await data(users.resident.client.auth.updateUser({data:{role:'admin'}}),'editable metadata test');assert.ok((await users.resident.client.rpc('moderate_report',args)).error);
  assert.ok((await users.observer.client.rpc('visitor_report_contact',{target_report_id:identified.body.id})).error);
  const contact=await data(users.moderator.client.rpc('visitor_report_contact',{target_report_id:identified.body.id}),'staff contact');assert.equal(contact.email,'fictional@example.invalid');
  assert.ok((await users.observer.client.storage.from('report-evidence').createSignedUrl(evidence.object_path,60)).error);
  const signed=await data(users.moderator.client.storage.from('report-evidence').createSignedUrl(evidence.object_path,60),'moderator signed URL');assert.equal((await fetch(signed.signedUrl)).status,200);
  passed('real password sessions enforce database roles, confidential contact and private Storage RLS; editable metadata cannot grant moderation');
  for(const next_status of ['under_review','approved','verified','in_progress','resolved'])await data(users.moderator.client.rpc('moderate_report',{...args,next_status,next_priority:'high'}),'moderation transition');
  const progress=await post('track',{trackingCredential:secret});assert.equal(progress.body.report.status,'resolved');assert.equal(progress.body.report.priority,'high');assert.ok(!JSON.stringify(progress).includes('Private fictional note'));
  assert.equal((await data(visitor.from('public_report_feed').select('id').eq('id',id),'public feed')).length,1);
  assert.equal((await data(users.observer.client.from('reports').select('reporter_id').eq('id',id),'private owner identity')).length,0);
  sql(`update profiles set role='resident' where id='${users.moderator.id}'`);assert.ok((await users.moderator.client.rpc('moderate_report',args)).error);sql(`update profiles set role='moderator' where id='${users.moderator.id}'`);
  await data(users.moderator.client.rpc('moderate_report',{...args,target_report_id:identified.body.id,next_status:'rejected',resident_note:'Fictional rejection reason'}),'reject concern');
  assert.equal((await post('track',{trackingCredential:confidentialKey})).body.report.status,'rejected');
  assert.equal((await data(visitor.from('public_report_feed').select('id').eq('id',identified.body.id),'rejected visibility')).length,0);
  passed('real moderation approval/rejection, priority, private/resident notes, status transitions, publication and role revocation persist');
  const own=await data(users.resident.client.from('reports').insert({title:`Account concern ${runId}`,description:sample.description,category_slug:'environment',municipality:'Guiuan'}).select('id').single(),'existing resident submission');
  const ownPath=`${own.id}/${randomUUID()}.png`;await data(users.resident.client.storage.from('report-evidence').upload(ownPath,photo,{contentType:'image/png',upsert:false}),'existing resident photo');
  await data(users.resident.client.from('report_evidence').insert({report_id:own.id,uploaded_by:users.resident.id,object_path:ownPath,content_type:'image/png',byte_size:photo.length}),'resident photo metadata');
  assert.ok((await data(users.resident.client.rpc('my_reports'),'owner history')).some(row=>row.id===own.id));
  const activity=await data(users.moderator.client.from('volunteer_opportunities').insert({report_id:id,title:`Fictional activity ${runId}`,description:sample.description,category:'environment',municipality:'Guiuan',starts_at:new Date(Date.now()+86400000).toISOString(),capacity:2,status:'published',organizer_id:users.moderator.id}).select('id').single(),'existing volunteer creation');
  await data(users.resident.client.rpc('join_volunteer_opportunity',{p_opportunity_id:activity.id}),'existing volunteer registration');
  assert.equal((await data(users.resident.client.from('volunteer_registrations').select('id,status').eq('opportunity_id',activity.id),'resident registration')).length,1);
  passed('existing authenticated report/upload/history and volunteer creation/registration remain functional');
  sql('truncate private.visitor_attempts'); // Dedicated local test counter; never production.
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chromium',headless:true});let unexpectedFunctions=0;
  async function pageFor(width){const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});contexts.push(context);
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/functions/')){unexpectedFunctions++;return route.abort();}return [base,settings.url].includes(url.origin)?route.continue():route.abort();});return context.newPage();}
  const browserReports=[];
  for(const [width,language]of [[320,'en'],[390,'war'],[1440,'en']]){
    const page=await pageFor(width);await page.goto(base);await page.locator('.topbar .language-selector select').selectOption(language);await page.waitForFunction(code=>document.documentElement.lang===code,language);
    await page.locator('.hero-actions .primary-button').click();const form=page.locator('.report-modal').filter({has:page.locator('#report-form-title')});await form.waitFor();
    assert.equal(await form.locator('.report-identity select').inputValue(),'anonymous');
    await form.locator('input[name=title]').fill(`Browser Docker concern ${width} ${runId}`);await form.locator('textarea[name=description]').fill(sample.description);
    await form.locator('input[type=file]').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:photo});await form.locator('.modal-foot-actions .primary-button').click();await form.locator('select[name=municipality]').selectOption('Guiuan');await form.locator('.modal-foot-actions .primary-button').click();await form.locator('.modal-foot-actions .primary-button').click();
    const receipt=page.locator('.receipt-dialog');await receipt.waitFor();const credential=await receipt.locator('textarea').inputValue();const reportId=(await receipt.locator('.receipt-reference').innerText()).trim();browserReports.push({id:reportId,credential});
    await receipt.locator('.primary-button').click();const tracking=page.locator('.report-modal').filter({has:page.locator('#tracking-title')});await tracking.locator('input[type=password]').fill(credential);await tracking.locator('.primary-button').click();await tracking.locator('section[aria-live=polite] h3').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  passed('real browser anonymous submission, photo and status tracking at 320/390/1440 pixels, including asserted Waray');
  const moderatorPage=await pageFor(1440);await moderatorPage.goto(base);await moderatorPage.locator('.header-profile').click();await moderatorPage.locator('.resident-profile .primary-button').click();const auth=moderatorPage.locator('.auth-modal');await auth.locator('input[type=email]').fill(users.moderator.email);await auth.locator('input[type=password]').fill(users.moderator.password);await auth.locator('button[type=submit]').click();await auth.waitFor({state:'detached'});
  await moderatorPage.goto(base+'/operations/');await moderatorPage.locator('.ops-nav').waitFor();await moderatorPage.locator('.ops-nav nav button').nth(2).click();await moderatorPage.locator('.review-table tbody tr').filter({hasText:`Browser Docker concern 320 ${runId}`}).locator('.review-report-title').click();
  const review=moderatorPage.locator('.review-modal');await review.locator('form select').first().selectOption('verified');await review.locator('textarea').first().fill('Fictional browser review completed.');await review.locator('textarea').last().fill('Private fictional browser note.');await review.locator('button[type=submit]').click();await review.waitFor({state:'detached'});
  const publicPage=await pageFor(390);await publicPage.goto(base);await publicPage.locator('.report-title').filter({hasText:`Browser Docker concern 320 ${runId}`}).first().waitFor({state:'attached'});
  assert.equal((await post('track',{trackingCredential:browserReports[0].credential})).body.report.status,'verified');
  passed('actual browser moderator password login, persisted verification and anonymous public map publication');
  const preflight=JSON.parse(sql(await readFile(new URL('../../supabase/verification/anonymous-release-preflight.sql',import.meta.url),'utf8')));
  assert.equal(preflight.visitor_installed,true);assert.equal(preflight.moderation_anon_execute,false);assert.deepEqual(preflight.public_rls_disabled,[]);
  const recordsBefore=Number(sql('select count(*) from public.reports'));
  sql(await readFile(new URL('../../supabase/proposed/pause_visitor_ingress.sql',import.meta.url),'utf8'));
  const pauseArgs={payload:{...sample,title:'Fictional paused concern'},tracking_hash:sha('isolated-paused-attempt'),source_hash:sha('isolated-paused-source'),payload_hash:sha('isolated-paused-body'),has_photo:false};
  assert.ok((await admin.rpc('submit_visitor_report',pauseArgs)).error);
  assert.equal((await post('track',{trackingCredential:secret})).status,200);
  assert.equal(Number(sql('select count(*) from public.reports')),recordsBefore);
  sql("grant execute on function public.submit_visitor_report(jsonb,text,text,text,boolean),public.finalize_visitor_photo(uuid,text) to service_role;notify pgrst,'reload schema';");
  passed('read-only release preflight and reversible visitor write pause preserve records, tracking and moderator access');
  assert.equal(unexpectedFunctions,0);
  const result={environment:'ephemeral full Supabase Docker stack',hostedSupabase:false,productionTouched:false,auth:true,postgrest:true,storageAPI:true,realImageBytes:true,realBrowser:true,checks,aiOrEmailFunctionsCalled:false};
  await mkdir('test-results.local/full-stack',{recursive:true});await writeFile('test-results.local/full-stack/results.json',JSON.stringify(result,null,2));
  console.log('FULL_STACK_RESULT '+JSON.stringify(result));
}catch(error){
  let detail=String(error.detail || error.message);
  for(const value of [settings.anon,settings.service,process.env.ANON_SOURCE_HMAC_KEY,...Object.values(users).map(user=>user.password)])if(value)detail=detail.replaceAll(value,'[redacted]');
  detail=detail.replace(/[A-Za-z0-9_-]{32,}(?:\.[A-Za-z0-9_-]+)*/g,'[redacted]');
  console.error('FULL_STACK_FAILURE '+JSON.stringify({stage:error.stage || 'assertion',code:error.providerCode,detail}));process.exitCode=1;
}
finally{for(const context of contexts)await context.close();await browser?.close();await vite.close();await new Promise(resolve=>api.close(resolve));}
