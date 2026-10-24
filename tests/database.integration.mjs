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
    const names=(await readdir(directory)).filter(name=>name.endsWith('.sql') && !/review_decision|ai_review_runs|leaderboard_and_email|platform_completion|community_recognition/.test(name)).sort();
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

test('recognition repair works on legacy schema, protects identity, ranks ties and derives verified milestones', async () => {
  const db = new PGlite();
  try {
    await bootstrapDatabase(db);
    const directory = new URL('../supabase/migrations/',import.meta.url);
    for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql') && !/review_decision|ai_review_runs|leaderboard_and_email|platform_completion|community_recognition/.test(name)).sort()) await db.exec(await readFile(new URL(name,directory),'utf8'));
    const sql = await readFile(new URL('20261024183629_community_recognition.sql',directory),'utf8');
    await db.exec(sql);
    await db.exec(sql); // Additive repair is safe to retry.
    const people = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
    await db.exec(`insert into auth.users(id) values ${people.map(id=>`('${id}')`).join(',')}; update profiles set display_name='PRIVATE legal name';`);
    async function as(role,id,query) {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id || ''}',false); set role ${role}`);
      try {return (await db.query(query)).rows;} finally {await db.exec('reset role');}
    }
    assert.deepEqual(await as('anon',null,'select * from get_community_recognition()'),[]);
    await assert.rejects(as('anon',null,'select get_my_recognition()'),/permission denied/);
    await assert.rejects(as('authenticated',null,'select get_my_recognition()'),/Sign in/);
    const staff='44444444-4444-4444-8444-444444444444';
    await db.exec(`insert into auth.users(id) values('${staff}'); update profiles set role='admin' where id='${staff}'; select set_config('request.jwt.claim.sub','${staff}',false)`);
    for(let index=0;index<6;index++) {
      const activity=(await db.query(`insert into volunteer_opportunities(title,description,status,category,municipality,organizer_id) values('Verified test action ${index}','Isolated PostgreSQL fixture only.','published','environment','${index%2?'Guiuan':'Borongan City'}','${staff}') returning id`)).rows[0].id;
      for(const [n,id] of people.entries()) await db.exec(`insert into volunteer_registrations(opportunity_id,volunteer_id,status,volunteer_hours) values('${activity}','${id}','${index===5?'registered':'completed'}',${index===5?99:n===2?4:8})`);
    }
    // Actual service does not imply public consent.
    assert.equal((await as('anon',null,'select * from get_community_recognition()')).length,0);
    for(const [n,id] of people.entries()) await as('authenticated',id,`update profiles set public_alias='Helper ${n}',show_on_leaderboard=true where id='${id}'`);
    const publicRows=await as('anon',null,'select * from get_community_recognition()');
    assert.deepEqual(publicRows.map(row=>Number(row.rank)),[1,1,2]);
    assert.deepEqual(publicRows.map(row=>Number(row.verified_hours)),[40,40,20]);
    assert.equal(Number(publicRows[0].completed_activities),5);
    assert.equal(publicRows[0].badges.length,5);
    assert.equal(JSON.stringify(publicRows).includes('PRIVATE'),false);
    assert.deepEqual(Object.keys(publicRows[0]).sort(),['rank','public_alias','verified_hours','completed_activities','badges'].sort());
    const mine=(await as('authenticated',people[0],'select get_my_recognition() result'))[0].result;
    assert.equal(mine.history.length,5);
    assert.equal(Number(mine.verified_hours),40);
    assert.equal(Number(mine.rank),1);
    await assert.rejects(as('anon',null,'select * from private.recognition_totals'),/permission denied/);
    await assert.rejects(as('authenticated',people[0],'select * from private.recognition_totals'),/permission denied/);
    assert.equal((await as('authenticated',people[0],`select id from profiles where id='${people[1]}'`)).length,0);
    await as('authenticated',people[0],`update profiles set show_on_leaderboard=false where id='${people[0]}'`);
    assert.equal((await as('anon',null,'select * from get_community_recognition()')).length,2);
    assert.equal((await as('authenticated',people[0],'select get_my_recognition() result'))[0].result.history.length,5);
    await db.exec(`update volunteer_registrations set status='no_show' where volunteer_id='${people[1]}'`);
    assert.equal((await as('anon',null,'select * from get_community_recognition()')).length,1);
    const revoked=(await as('authenticated',people[1],'select get_my_recognition() result'))[0].result;
    assert.deepEqual(revoked.badges,[]); assert.equal(Number(revoked.verified_hours),0);
    // Attended hours are verified but do not award a completion milestone.
    await db.exec(`update volunteer_registrations set status='attended' where volunteer_id='${people[1]}'`);
    const attended=(await as('authenticated',people[1],'select get_my_recognition() result'))[0].result;
    assert.equal(Number(attended.completed_activities),0); assert.deepEqual(attended.badges,[]);
    const thresholds=await db.query(`select private.recognition_badges(39,4,2,1) low, private.recognition_badges(40,5,3,2) high`);
    assert.deepEqual(thresholds.rows[0].low,['first-community-action','active-volunteer']); assert.equal(thresholds.rows[0].high.length,5);
  } finally {await db.close();}
});
