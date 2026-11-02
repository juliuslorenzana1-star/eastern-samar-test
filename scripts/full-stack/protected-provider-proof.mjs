// One-off approved hosted proof. Runs at BUILD TIME on the protected preview,
// never as a public administrative endpoint and never in a Production build.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomBytes,createHash} from 'node:crypto';
import sharp from 'sharp';
const env=process.env;
if(env.VERCEL_ENV!=='preview' || env.VERCEL_GIT_COMMIT_REF!=='codex/full-stack-verification' || env.PROTECTED_HOSTED_TEST!=='true' || env.SUPABASE_URL!=='https://xoitncotbgobcsdmvyjb.supabase.co')throw Error('Protected provider proof target/authorization mismatch');
if(!/^[a-f0-9]{16}$/.test(env.PROTECTED_TEST_RUN_ID || '') || !env.PROTECTED_TEST_PASSWORD || !env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Protected test configuration missing');
const run=env.PROTECTED_TEST_RUN_ID;
const make=key=>createClient(env.SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=make(env.SUPABASE_SERVICE_ROLE_KEY),clients={},ids={};
const safeError=e=>String(e.message || e).replaceAll(env.SUPABASE_SERVICE_ROLE_KEY,'[redacted]').replaceAll(env.PROTECTED_TEST_PASSWORD,'[redacted]').replace(/[A-Za-z0-9_-]{32,}(?:\.[A-Za-z0-9_-]+)*/g,'[redacted]');
async function checked(p,label){const r=await p;if(r.error)throw Error(label+': '+r.error.message);return r.data;}
try{
  if(env.PROTECTED_TEST_PHASE==='retire'){
    for(const role of ['resident','moderator']){
      const id=env[`PROTECTED_TEST_${role.toUpperCase()}_ID`];assert.match(id||'',/^[a-f0-9-]{36}$/);
      const {user}=await checked(admin.auth.admin.getUserById(id),'Read owned test identity');
      assert.equal(user.app_metadata?.protected_smoke_run,run);
      await checked(admin.from('profiles').update({role:'resident'}).eq('id',id),'Remove fixture privileges');
      await checked(admin.auth.admin.updateUserById(id,{ban_duration:'876000h'}),'Retire fixture login');
    }
    console.log('HOSTED_PROVIDER_RETIREMENT '+JSON.stringify({run,fixturePrivilegesRemoved:true,fixtureLoginsBanned:true,recordsDeleted:false}));
  }else{
    assert.equal(env.PROTECTED_TEST_PHASE,'provision');
    for(const role of ['resident','moderator']){
      const email=`protected-${role}-${run}@example.invalid`;const c=make(env.VITE_SUPABASE_PUBLISHABLE_KEY);
      const created=await admin.auth.admin.createUser({email,password:env.PROTECTED_TEST_PASSWORD,email_confirm:true,app_metadata:{protected_smoke_run:run},user_metadata:{display_name:'Fictional protected tester'}});
      if(created.error && !/already|registered/i.test(created.error.message))throw Error('Create fixture identity: '+created.error.message);
      const login=await checked(c.auth.signInWithPassword({email,password:env.PROTECTED_TEST_PASSWORD}),'Real protected password login');
      assert.equal(login.user.app_metadata?.protected_smoke_run,run);ids[role]=login.user.id;clients[role]=c;
      if(role==='moderator')await checked(admin.from('profiles').update({role:'moderator'}).eq('id',login.user.id),'Assign owned fixture moderator');
    }
    console.log('HOSTED_FIXTURE_IDS '+JSON.stringify({run,...ids}));
    const hash=()=>createHash('sha256').update(randomBytes(32)).digest('hex');const tracking_hash=hash();
    const report=await checked(admin.rpc('submit_visitor_report',{payload:{title:`PROTECTED TEST ${run} private concern`,description:'Fictional private hosted test. Never approve or publish this record.',category:'environment',municipality:'Guiuan',barangay:'',priority:'normal',contact:{email:'fictional@example.invalid'}},tracking_hash,source_hash:hash(),payload_hash:hash(),has_photo:true}),'Private visitor submission');
    const image=await sharp({create:{width:12,height:12,channels:3,background:'green'}}).jpeg().toBuffer();
    await checked(admin.storage.from('report-evidence').upload(report.objectPath,image,{contentType:'image/jpeg',upsert:false}),'Actual hosted photo upload');
    await checked(admin.rpc('finalize_visitor_photo',{target_report_id:report.id,tracking_hash}),'Hosted photo metadata');
    const args={target_report_id:report.id,next_status:'under_review',next_priority:'high',internal_note:'Private fictional hosted test note',resident_note:'Fictional private review update'};
    assert.ok((await clients.resident.rpc('moderate_report',args)).error);
    assert.ok((await clients.resident.rpc('visitor_report_contact',{target_report_id:report.id})).error);
    assert.ok((await clients.resident.storage.from('report-evidence').createSignedUrl(report.objectPath,60)).error);
    const contact=await checked(clients.moderator.rpc('visitor_report_contact',{target_report_id:report.id}),'Hosted moderator contact');assert.equal(contact.email,'fictional@example.invalid');
    const signed=await checked(clients.moderator.storage.from('report-evidence').createSignedUrl(report.objectPath,60),'Hosted moderator evidence');assert.equal((await fetch(signed.signedUrl)).status,200);
    await checked(clients.moderator.rpc('moderate_report',args),'Hosted private moderation');
    await checked(clients.moderator.rpc('moderate_report',{...args,next_status:'rejected',resident_note:'Fictional test completed; do not publish.'}),'Hosted rejection');
    const tracked=await checked(admin.rpc('track_visitor_report',{tracking_hash}),'Hosted tracking');assert.equal(tracked.status,'rejected');
    const visitor=make(env.VITE_SUPABASE_PUBLISHABLE_KEY);const visible=await checked(visitor.from('public_report_feed').select('id').eq('id',report.id),'Hosted public exclusion');assert.equal(visible.length,0);
    console.log('HOSTED_PROVIDER_PROOF '+JSON.stringify({run,reportId:report.id,realPasswordLogin:true,realStorage:true,moderatorEvidence:true,residentDenied:true,privateModeration:true,tracking:true,publicTestDistribution:false}));
  }
}catch(error){console.error('HOSTED_PROVIDER_FAILURE '+safeError(error));process.exitCode=1;}
