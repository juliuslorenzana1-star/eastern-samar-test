// Real PostgreSQL policies/functions in isolated WASM Postgres. No production writes.
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function bootstrapDatabase(db) {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public,storage to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    `);
}

test('database migrations enforce reporting, moderation, capacity and privacy', async () => {
  const db = new PGlite();
  try {
    await bootstrapDatabase(db);
    const directory = new URL('../supabase/migrations/',import.meta.url);
    for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(name,directory),'utf8'));
    }
    const resident='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', moderator='33333333-3333-4333-8333-333333333333';
    await db.exec(`insert into auth.users(id) values('${resident}'),('${other}'),('${moderator}'); update public.profiles set role='moderator' where id='${moderator}';`);
    await db.exec(`insert into auth.users(id,raw_user_meta_data) values('44444444-4444-4444-8444-444444444444','{"role":"admin"}')`);
    assert.equal((await db.query(`select role from profiles where id='44444444-4444-4444-8444-444444444444'`)).rows[0].role,'resident');
    async function as(role,id,sql) {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id || ''}',false); set role ${role};`);
      try { return await db.query(sql); } finally { await db.exec('reset role'); }
    }
    const insert = `insert into public.reports(title,description,category_slug,municipality,latitude,longitude) values('Coastal concern','A concern needing community review.','environment','Guiuan',11.034,125.723) returning id,status,is_public,latitude`;
    const result=await as('authenticated',resident,insert);
    const reportId=result.rows[0].id;
    assert.equal(result.rows[0].status,'pending_review');
    assert.equal(result.rows[0].is_public,false);
    assert.equal(result.rows[0].latitude,11.03);
    assert.equal((await as('anon',null,'select id from reports')).rows.length,0);
    assert.equal((await as('authenticated',other,'select id from reports')).rows.length,0);
    assert.equal((await as('authenticated',resident,'select * from my_reports()')).rows.length,1);
    await assert.rejects(as('authenticated',resident,insert),/already submitted/);
    await assert.rejects(as('authenticated',resident,`update reports set status='verified' where id='${reportId}'`),/permission denied/);
    await assert.rejects(as('authenticated',resident,`update profiles set role='admin' where id='${resident}'`),/administrator/);
    await assert.rejects(as('authenticated',resident,`select moderate_report('${reportId}','verified','normal',null,null)`),/Moderator/);
    await assert.rejects(as('authenticated',moderator,`select moderate_report('${reportId}','rejected','normal',null,null)`),/reason/);
    await as('authenticated',moderator,`select moderate_report('${reportId}','verified','normal','Private investigation note',null)`);
    assert.equal((await as('anon',null,'select id from reports')).rows.length,1);
    await assert.rejects(as('anon',null,'select reporter_id from reports'),/permission denied/);
    await assert.rejects(as('anon',null,'select * from moderator_notes'),/permission denied/);
    const progress=await as('anon',null,`select * from report_progress('${reportId}')`);
    assert.equal(progress.rows.length,1);
    assert.deepEqual(Object.keys(progress.rows[0]).sort(),['created_at','id','status']);
    const lifecycle=await as('anon',null,`select verification_status,resolution_status from reports`);
    assert.deepEqual(lifecycle.rows[0],{verification_status:'verified',resolution_status:'open'});
    const metrics=(await as('anon',null,'select * from platform_statistics()')).rows[0];
    assert.equal(Number(metrics.total_reports),1);
    assert.equal(metrics.pending_reports,null);
    assert.equal(Number(metrics.verified_reports),1);
    await as('authenticated',resident,`insert into report_private_locations(report_id,latitude,longitude) values('${reportId}',11.034,125.723)`);
    assert.equal((await as('authenticated',other,'select * from report_private_locations')).rows.length,0);
    assert.equal((await as('authenticated',resident,'select * from moderator_notes')).rows.length,0);
    await assert.rejects(as('authenticated',resident,`select claim_email_notification('${resident}','report_submission','${reportId}')`),/permission denied/);
    await assert.rejects(as('anon',null,'select create_profile_for_auth_user()'),/permission denied/);
    assert.equal((await as('service_role',null,`select claim_email_notification('${resident}','report_submission','${reportId}') result`)).rows[0].result,'claimed');
    assert.equal((await as('service_role',null,`select claim_email_notification('${resident}','report_submission','${reportId}') result`)).rows[0].result,'reserved');
    for(let index=0;index<9;index++)await as('service_role',null,`select claim_email_notification('${resident}','report_submission',gen_random_uuid())`);
    assert.equal((await as('service_role',null,`select claim_email_notification('${resident}','report_submission',gen_random_uuid()) result`)).rows[0].result,'rate_limited');
    const activity=(await as('authenticated',moderator,`insert into volunteer_opportunities(title,description,capacity,status,starts_at,organizer_id) values('Coastal cleanup','A safe isolated integration test activity.',1,'published',now()+interval '7 days','${moderator}') returning id`)).rows[0].id;
    const registration=(await as('authenticated',resident,`select join_volunteer_opportunity('${activity}') id`)).rows[0].id;
    await assert.rejects(as('authenticated',resident,`select join_volunteer_opportunity('${activity}')`),/already/);
    await assert.rejects(as('authenticated',other,`select join_volunteer_opportunity('${activity}')`),/capacity/);
    await assert.rejects(as('authenticated',resident,`select record_volunteer_attendance('${registration}','completed',4)`),/staff/);
    await as('authenticated',moderator,`select record_volunteer_attendance('${registration}','completed',4)`);
    assert.equal((await as('anon',null,'select * from get_public_leaderboard()')).rows.length,0);
    await as('authenticated',resident,`update profiles set public_alias='Coastal helper',show_on_leaderboard=true where id='${resident}'`);
    assert.equal((await as('anon',null,'select * from get_public_leaderboard()')).rows[0].display_name,'Coastal helper');
    assert.equal((await as('authenticated',resident,'select * from platform_audit')).rows.length,0);
    assert.ok((await as('authenticated',moderator,'select * from platform_audit')).rows.length>=2);
    await as('authenticated',moderator,`select moderate_report('${reportId}','resolved','normal',null,null)`);
    assert.deepEqual((await as('anon',null,'select verification_status,resolution_status from reports')).rows[0],{verification_status:'verified',resolution_status:'resolved'});
    for(let index=0;index<5;index++)await as('authenticated',other,`insert into reports(title,description,category_slug,municipality) values('Separate concern ${index}','A distinct community concern number ${index}.','environment','Guiuan')`);
    await assert.rejects(as('authenticated',other,`insert into reports(title,description,category_slug,municipality) values('Sixth concern','A sixth distinct concern within ten minutes.','environment','Guiuan')`),/wait before/);
  } finally { await db.close(); }
});

test('one-time production repair upgrades the inspected legacy shape without replacing records',async()=>{
  const db=new PGlite();
  try {
    await bootstrapDatabase(db);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    const names=(await readdir(directory)).filter(name=>name.endsWith('.sql') && !/review_decision|ai_review_runs|leaderboard_and_email|platform_completion/.test(name)).sort();
    for(const name of names)await db.exec(await readFile(new URL(name,directory),'utf8'));
    const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await db.exec(`insert into auth.users(id) values('${owner}'); select set_config('request.jwt.claim.sub','${owner}',false);`);
    const old=(await db.query(`insert into reports(title,description,category_slug,municipality) values('Legacy concern','Preserve this original resident submission.','environment','Guiuan') returning id,title,updated_at`)).rows[0];
    await db.exec('grant select(reporter_id) on public.reports to anon,authenticated');
    await db.exec(await readFile(new URL('../supabase/proposed/production_readiness_repair.sql',import.meta.url),'utf8'));
    const current=(await db.query('select id,title,updated_at,verification_status,resolution_status from reports')).rows[0];
    assert.equal(current.id,old.id);
    assert.equal(current.title,old.title);
    assert.equal(current.updated_at.toISOString(),old.updated_at.toISOString());
    assert.equal(current.verification_status,'pending_review');
    assert.equal((await db.query(`select has_column_privilege('anon','public.reports','reporter_id','select') allowed`)).rows[0].allowed,false);
    assert.equal((await db.query('select count(*)::int total from my_reports()')).rows[0].total,1);
    await assert.rejects(db.exec(await readFile(new URL('../supabase/proposed/production_readiness_repair.sql',import.meta.url),'utf8')),/already applied/);
    await db.exec('rollback');
  }finally{await db.close();}
});
