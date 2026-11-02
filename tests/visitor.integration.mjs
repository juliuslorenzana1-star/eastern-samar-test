import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes,createHash } from 'node:crypto';
import sharp from 'sharp';
import { createVisitorHandler } from '../server/visitor-handler.mjs';
import { visitorDatabase } from './support/visitor-database.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const sample={title:'Fictional broken pathway',description:'Fictional concern for isolated testing only.',category:'infrastructure',municipality:'Guiuan',barangay:'',priority:'normal',location:{lat:11.02,lng:125.72}};

test('real HTTP ingress persists anonymous reports, photos and private tracking; existing moderation/RLS remain authoritative',async()=>{
  const ctx=await visitorDatabase();const {db,as,database,storage,objects}=ctx;
  const env={ANON_REPORTING_ENABLED:'true',ANON_ENVIRONMENT:'isolated',SUPABASE_URL:'http://127.0.0.1:54321',ANON_ALLOWED_ORIGIN:'http://authorized.local',ANON_SOURCE_HMAC_KEY:'local-test-secret-not-a-provider-key-123456'};
  const server=createServer(createVisitorHandler({env,database,storage}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/anonymous`;
  const post=async(operation,body,origin=env.ANON_ALLOWED_ORIGIN)=>{const response=await fetch(url,{method:'POST',headers:{origin,'content-type':'application/json','x-report-operation':operation},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  try {
    const trackingCredential=randomBytes(32).toString('base64url');
    const photo=(await sharp({create:{width:16,height:16,channels:3,background:'green'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'Must be removed'}}}).toBuffer()).toString('base64');
    const body={trackingCredential,report:{...sample,contact:{email:'fictional@example.invalid'}},photo};
    const saved=await post('submit',body);
    assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.photoSaved,true);
    const id=saved.body.id;
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,0);
    const row=(await db.query('select reporter_id,status,is_public from reports where id=$1',[id])).rows[0];
    assert.deepEqual(row,{reporter_id:null,status:'pending_review',is_public:false});
    assert.equal((await as('anon',null,'select id from reports')).rows.length,0);
    assert.equal((await db.query('select count(*)::int n from report_private_locations where report_id=$1',[id])).rows[0].n,1);
    assert.equal(objects.size,1);assert.equal((await sharp([...objects.values()][0]).metadata()).exif,undefined);
    assert.equal((await db.query('select uploaded_by from report_evidence where report_id=$1',[id])).rows[0].uploaded_by,null);
    const tracked=await post('track',{trackingCredential});assert.equal(tracked.body.report.status,'pending_review');
    assert.equal(JSON.stringify(tracked).includes('fictional@example.invalid'),false);
    assert.equal(JSON.stringify(tracked).includes('source_hash'),false);
    assert.equal((await post('track',{trackingCredential:randomBytes(32).toString('base64url')})).status,404);
    assert.equal((await post('submit',body)).body.id,id);
    assert.equal((await db.query('select count(*)::int n from reports')).rows[0].n,1);
    await assert.rejects(as('anon',null,'select * from private.visitor_reports'),/permission denied/);
    await assert.rejects(as('anon',null,'select track_visitor_report($1)',[hash(trackingCredential)]),/permission denied/);
    await assert.rejects(as('anon',null,"insert into reports(title,description,category_slug,municipality)values('Invalid anonymous write','This bypass must not work.','infrastructure','Guiuan')"),/permission denied|Sign in|row-level security/);
    const mod='11111111-1111-4111-8111-111111111111',resident='22222222-2222-4222-8222-222222222222';
    await db.exec(`insert into auth.users(id)values('${mod}'),('${resident}');update profiles set role='moderator' where id='${mod}'`);
    await assert.rejects(as('authenticated',resident,'select visitor_report_contact($1)',[id]),/Moderator/);
    await assert.rejects(as('authenticated',resident,"select moderate_report($1,'approved','normal',null,null)",[id]),/Moderator|authorized|permission/i);
    assert.equal((await as('authenticated',mod,'select visitor_report_contact($1) result',[id])).rows[0].result.email,'fictional@example.invalid');
    for(const status of ['under_review','approved','verified','in_progress','resolved']){
      await as('authenticated',mod,'select moderate_report($1,$2::report_status,$3::report_priority,$4,$5)',[id,status,'high','Private moderator test note','Resident-facing test note']);
    }
    assert.equal((await post('track',{trackingCredential})).body.report.status,'resolved');
    assert.equal(JSON.stringify((await post('track',{trackingCredential})).body).includes('Private moderator test note'),false);
    assert.equal((await as('anon',null,'select id from reports')).rows.length,1);
    const publicFeed=(await as('authenticated',resident,'select * from public_report_feed')).rows;
    assert.equal(publicFeed.length,1);assert.equal('reporter_id' in publicFeed[0],false);assert.equal('decision_note' in publicFeed[0],false);
    assert.deepEqual((await as('authenticated',resident,'select reporter_id from reports where id=$1',[id])).rows,[]);
    await assert.rejects(as('authenticated',resident,'select * from private.visitor_reports'),/permission denied/);
    assert.equal((await as('authenticated',resident,'select * from my_reports()')).rows.length,0);
    assert.equal((await as('authenticated',resident,'select id from report_evidence where report_id=$1',[id])).rows.length,0);
    assert.equal((await as('authenticated',resident,"select name from storage.objects where bucket_id='report-evidence'")).rows.length,0);
    assert.equal((await as('authenticated',mod,'select id from report_evidence where report_id=$1',[id])).rows.length,1);
    await as('authenticated',resident,"insert into reports(title,description,category_slug,municipality)values('Existing account workflow','This account-linked concern still works.','infrastructure','Guiuan')");
    assert.equal((await as('authenticated',resident,'select * from my_reports()')).rows.length,1);
    const rejectKey=randomBytes(32).toString('base64url');
    const second=await post('submit',{trackingCredential:rejectKey,report:sample});assert.equal(second.status,200,JSON.stringify(second.body));
    await as('authenticated',mod,"select moderate_report($1,'rejected','normal','Internal rejection','Please correct the fictional concern.')",[second.body.id]);
    assert.equal((await post('track',{trackingCredential:rejectKey})).body.report.status,'rejected');
    assert.equal((await as('anon',null,'select id from reports where id=$1',[second.body.id])).rows.length,0);
    assert.equal((await post('submit',{trackingCredential:randomBytes(32).toString('base64url'),report:{...sample,status:'approved'}})).status,400);
    assert.equal((await post('submit',body,'https://attacker.invalid')).status,403);
    assert.equal((await post('submit',body)).status,200);
    assert.equal((await post('submit',body)).status,429);
    assert.equal((await db.query('select count(*)::int n from private.visitor_write_context')).rows[0].n,0);
  }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});

test('durable visitor quotas serialize concurrent attempts and reserve shared evidence capacity',async()=>{
  const {db,database}=await visitorDatabase();
  try{
    const source=hash('source-A');
    const claims=await Promise.all(Array.from({length:12},()=>database.rpc('claim_visitor_attempt',{source,operation:'submit'})));
    assert.equal(claims.filter(Boolean).length,5);
    const payload={...sample,location:null};
    const args={payload,tracking_hash:hash('capacity-test'),source_hash:source,payload_hash:hash(JSON.stringify(payload)),has_photo:true};
    const first=await database.rpc('submit_visitor_report',args);
    // Reserved but failed uploads still count: an orphan cannot reset a quota.
    await db.exec("insert into storage.objects(bucket_id,name,metadata)select 'report-evidence',gen_random_uuid()::text||'/test.png','{\"size\":1,\"mimetype\":\"image/png\"}'::jsonb from generate_series(1,99)");
    await assert.rejects(database.rpc('submit_visitor_report',{...args,tracking_hash:hash('another capacity-test')}),/Evidence allowance/);
    assert.equal((await db.query('select count(*)::int n from reports')).rows[0].n,1);
    assert.equal((await database.rpc('submit_visitor_report',args)).id,first.id);
    // A changed body cannot reuse a known receipt to replace a report/photo.
    await assert.rejects(database.rpc('submit_visitor_report',{...args,payload_hash:hash('modified')}),/different details/);
    // Daily source successes are checked in the transaction, even if a caller
    // with trusted service credentials were to bypass the HTTP attempt claim.
    for(let n=1;n<=19;n++)await database.rpc('submit_visitor_report',{...args,tracking_hash:hash(`source allowance ${n}`),has_photo:false});
    await assert.rejects(database.rpc('submit_visitor_report',{...args,has_photo:false,tracking_hash:hash('daily capacity-test')}),/Report allowance/);
  }finally{await db.close();}
});

test('visitor migration works on the inspected legacy shape and service RPC grants are narrow',async()=>{
  const {db,as,database}=await visitorDatabase({legacy:true});
  try{
    const payload={...sample,contact:{name:'Fictional Contact'}};
    const args={payload,tracking_hash:hash('test-only-token'),source_hash:hash('test-only-source'),payload_hash:hash(JSON.stringify(payload)),has_photo:false};
    const result=await database.rpc('submit_visitor_report',args);
    assert.ok(result.id);
    const tracked=await database.rpc('track_visitor_report',{tracking_hash:args.tracking_hash});assert.equal(tracked.status,'pending_review');
    for(const role of ['anon','authenticated']){
      assert.equal((await db.query("select has_function_privilege($1,'public.submit_visitor_report(jsonb,text,text,text,boolean)','execute') allowed",[role])).rows[0].allowed,false);
      await assert.rejects(as(role,null,'select track_visitor_report($1)',[args.tracking_hash]),/permission denied/);
    }
    const policies=(await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'visitor_%' and c.relkind='r' and not c.relrowsecurity")).rows[0].n;assert.equal(policies,0);
    const functions=(await db.query("select proconfig from pg_proc where proname in ('submit_visitor_report','track_visitor_report','finalize_visitor_photo','visitor_report_contact','claim_visitor_attempt')")).rows;
    assert.equal(functions.length,5);assert.ok(functions.every(row=>row.proconfig.includes('search_path=""')));
    assert.equal((await db.query("select count(*)::int n from public.reports where is_public or reporter_id is not null")).rows[0].n,0);
    await assert.rejects(database.rpc('submit_visitor_report',{...args,payload_hash:hash('different payload')}),/different details/);
  }finally{await db.close();}
});
