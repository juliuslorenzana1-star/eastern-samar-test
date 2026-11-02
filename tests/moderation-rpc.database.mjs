import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';

export function registerModerationRpcTests(bootstrapDatabase){
test('narrow moderation repair upgrades the live legacy contract with authorization, atomic audit and private feedback',async()=>{
 const db=new PGlite();try{
  await bootstrapDatabase(db);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  const names=(await readdir(dir)).filter(n=>n.endsWith('.sql')&&!/review_decision|ai_review_runs|leaderboard_and_email|platform_completion|community_recognition|moderate_report_contract_repair|anonymous_reporting_ingress/.test(n)).sort();
  for(const name of names)await db.exec(await readFile(new URL(name,dir),'utf8'));
  // The inspected live database has legacy table-wide SELECT grants.
  await db.exec('grant select on reports to anon,authenticated');
  const resident='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',moderator='33333333-3333-4333-8333-333333333333',admin='44444444-4444-4444-8444-444444444444';
  await db.exec(`insert into auth.users(id)values('${resident}'),('${other}'),('${moderator}'),('${admin}');update profiles set role='moderator' where id='${moderator}';update profiles set role='admin' where id='${admin}'`);
  async function as(role,id,sql){await db.exec(`select set_config('request.jwt.claim.sub','${id||''}',false);set role ${role}`);try{return(await db.query(sql)).rows;}finally{await db.exec('reset role');}}
  const id=(await as('authenticated',resident,`insert into reports(title,description,category_slug,municipality)values('ISOLATED moderation fixture','Fictional concern only, never production.','environment','Guiuan')returning id`))[0].id;
  const before=(await db.query(`select count(*)::int n from reports`)).rows[0].n;
  const file=(await readdir(dir)).find(n=>n.endsWith('_moderate_report_contract_repair.sql')),migration=await readFile(new URL(file,dir),'utf8');
  await db.exec(migration);await db.exec(migration); // Safe on both legacy and upgraded shapes.
  assert.equal((await db.query('select count(*)::int n from reports')).rows[0].n,before);
  assert.equal((await db.query(`select count(*)::int n from pg_proc where proname='moderate_report' and pronamespace='public'::regnamespace`)).rows[0].n,1);
  const metadata=(await db.query(`select proargnames,prosecdef,proconfig from pg_proc where oid='public.moderate_report(uuid,report_status,report_priority,text,text)'::regprocedure`)).rows[0];
  assert.deepEqual(metadata.proargnames,['target_report_id','next_status','next_priority','internal_note','resident_note']);assert.equal(metadata.prosecdef,true);assert.ok(metadata.proconfig.some(x=>x==='search_path=""'||x==='search_path='));
  const call=(status,priority='normal',staff='null',note='null')=>`select moderate_report('${id}','${status}','${priority}',${staff},${note})`;
  await assert.rejects(as('anon',null,call('approved')),/permission denied/);
  await assert.rejects(as('authenticated',null,call('approved')),/Moderator/);
  await assert.rejects(as('authenticated',resident,call('approved')),/Moderator/);
  await db.exec(`select set_config('request.jwt.claims','{"user_metadata":{"role":"admin"}}',false)`);
  await assert.rejects(as('authenticated',resident,call('approved')),/Moderator/);
  await assert.rejects(as('authenticated',resident,`update reports set status='approved' where id='${id}'`),/permission denied/);
  await assert.rejects(as('authenticated',moderator,call('rejected')),/reason/);
  await assert.rejects(as('authenticated',moderator,`select moderate_report('${id}',null,'normal')`),/required/);
  await assert.rejects(as('authenticated',moderator,`select moderate_report(gen_random_uuid(),'approved','normal')`),/not found/);

  await as('authenticated',moderator,call('approved','high',"'Private investigation'","'Resident update'"));
  let row=(await db.query(`select * from reports where id='${id}'`)).rows[0];assert.equal(row.is_public,true);assert.equal(row.priority,'high');assert.equal(row.reviewed_by,moderator);assert.ok(row.reviewed_at);assert.equal(row.decision_note,'Resident update');
  assert.equal((await as('authenticated',resident,'select * from my_reports()'))[0].decision_note,'Resident update');
  assert.equal((await as('authenticated',other,'select * from my_reports()')).length,0);
  assert.equal((await as('authenticated',resident,'select * from moderator_notes')).length,0);
  assert.equal((await as('authenticated',resident,'select * from platform_audit')).length,0);
  await assert.rejects(as('anon',null,'select decision_note from reports'),/permission denied/);
  await assert.rejects(as('anon',null,'select reporter_id from reports'),/permission denied/);
  await assert.rejects(as('authenticated',other,'select decision_note from reports'),/permission denied/);
  await assert.rejects(as('authenticated',other,'select reviewed_by from reports'),/permission denied/);
  assert.equal((await as('anon',null,`select id from reports where id='${id}'`)).length,1);
  assert.equal((await as('authenticated',moderator,'select * from moderator_notes'))[0].note,'Private investigation');
  const eventsBefore=(await db.query('select count(*)::int n from report_events')).rows[0].n;
  await as('authenticated',moderator,call('approved','urgent',"'Priority-only review'"));
  assert.equal((await db.query('select count(*)::int n from report_events')).rows[0].n,eventsBefore);
  let audits=await as('authenticated',moderator,'select * from platform_audit order by created_at');assert.equal(audits.length,2);assert.equal(audits[1].changes.before.priority,'high');assert.equal(audits[1].changes.after.priority,'urgent');

  // Several transitions in a single transaction share now(); event annotation
  // must not overwrite an earlier event chosen by random UUID ordering.
  await db.exec('begin');
  await as('authenticated',moderator,call('needs_more_information','normal',"'Private follow-up'","'Please clarify the location'"));
  await as('authenticated',moderator,call('rejected','normal','null',"'Duplicate fictional concern'"));
  await db.exec('commit');
  assert.deepEqual((await db.query(`select status,note from report_events where report_id='${id}' and status in ('needs_more_information','rejected') order by status::text`)).rows,[{status:'needs_more_information',note:'Please clarify the location'},{status:'rejected',note:'Duplicate fictional concern'}]);
  assert.equal((await as('anon',null,'select id from reports')).length,0);
  await assert.rejects(as('authenticated',moderator,call('verified')),/return to review/);
  await as('authenticated',moderator,call('pending_review'));
  for(const status of ['under_review','approved','verified','in_progress','resolved'])await as('authenticated',moderator,call(status));
  row=(await db.query(`select * from reports where id='${id}'`)).rows[0];assert.ok(row.verified_at);assert.ok(row.resolved_at);assert.equal(row.is_public,true);
  await as('authenticated',moderator,call('under_review'));row=(await db.query(`select * from reports where id='${id}'`)).rows[0];assert.equal(row.is_public,false);assert.equal(row.resolved_at,null);
  await as('authenticated',moderator,call('rejected','normal','null',"'Needs a fresh review'"));
  await as('authenticated',admin,call('verified','low','null',"'"+'a'.repeat(650)+"'"));
  assert.equal((await as('authenticated',resident,'select * from my_reports()'))[0].decision_note.length,600);

  const snapshot=JSON.stringify((await db.query(`select * from reports where id='${id}'`)).rows);
  const notes=(await db.query('select count(*)::int n from moderator_notes')).rows[0].n;
  await db.exec('alter table platform_audit add constraint isolated_audit_failure check(false) not valid');
  await assert.rejects(as('authenticated',moderator,call('resolved','urgent',"'Must roll back'")),/isolated_audit_failure/);
  assert.equal(JSON.stringify((await db.query(`select * from reports where id='${id}'`)).rows),snapshot);assert.equal((await db.query('select count(*)::int n from moderator_notes')).rows[0].n,notes);
  assert.equal((await db.query(`select bool_and(relrowsecurity) enabled from pg_class where oid in ('reports'::regclass,'moderator_notes'::regclass,'report_events'::regclass,'platform_audit'::regclass)`)).rows[0].enabled,true);
  await db.exec('alter table platform_audit drop constraint isolated_audit_failure');
  const counts=async()=>(await db.query('select (select count(*) from reports) reports,(select count(*) from auth.users) users,(select count(*) from moderator_notes) notes,(select count(*) from report_events) events,(select count(*) from platform_audit) audits')).rows[0];
  const beforeRollbackTest=await counts();
  const rollbackResults=await db.exec(await readFile(new URL('../supabase/verification/moderation_rpc_rollback.sql',import.meta.url),'utf8'));
  assert.match(rollbackResults.at(-1).rows[0].verification.result,/PASS/);
  assert.deepEqual(await counts(),beforeRollbackTest);
 }finally{await db.close();}
});
}
