-- Administrative verification only. New fictional records are transaction-local;
-- no existing report/account is a target. ROLLBACK is mandatory, never COMMIT.
-- Reviewed live Auth/report triggers perform no external email/API calls.
begin;
do $$
declare
  resident uuid:=gen_random_uuid(); moderator uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  v_report_id uuid; actual public.reports; audits integer; result_note text;
begin
  perform set_config('request.jwt.claim.sub','',true);
  insert into auth.users(id,raw_user_meta_data) values
    (resident,'{"display_name":"ISOLATED RPC resident"}'::jsonb),
    (moderator,'{"display_name":"ISOLATED RPC moderator"}'::jsonb),
    (outsider,'{"display_name":"ISOLATED RPC outsider"}'::jsonb);
  update public.profiles set role='moderator' where id=moderator;

  perform set_config('request.jwt.claim.sub',resident::text,true);
  execute 'set local role authenticated';
  insert into public.reports(title,description,category_slug,municipality)
    values('ISOLATED RPC TEST - ROLLBACK ONLY','Fictional moderation verification, never committed.','environment','Guiuan')
    returning id into v_report_id;
  begin
    perform public.moderate_report(v_report_id,'approved','normal',null,null);
    raise exception 'TEST FAILED: ordinary resident moderated a report';
  exception when insufficient_privilege then null; end;
  begin
    update public.reports set status='approved' where id=v_report_id;
    raise exception 'TEST FAILED: direct report update succeeded';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  execute 'set local role anon';
  begin
    perform public.moderate_report(v_report_id,'approved','normal',null,null);
    raise exception 'TEST FAILED: anonymous execution succeeded';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',moderator::text,true);
  execute 'set local role authenticated';
  begin
    perform public.moderate_report(v_report_id,'rejected','normal',null,null);
    raise exception 'TEST FAILED: rejection without explanation succeeded';
  exception when invalid_parameter_value then null; end;
  perform public.moderate_report(target_report_id=>v_report_id,next_status=>'approved',next_priority=>'high',internal_note=>'Private fictional investigation',resident_note=>'Fictional approval feedback');
  perform public.moderate_report(v_report_id,'approved','urgent','Private priority-only note',null);
  perform public.moderate_report(v_report_id,'needs_more_information','normal',null,'Clarify fictional location');
  perform public.moderate_report(v_report_id,'rejected','normal',null,'Fictional duplicate');
  begin
    perform public.moderate_report(v_report_id,'verified','normal',null,null);
    raise exception 'TEST FAILED: rejected report bypassed review';
  exception when insufficient_privilege then null; end;
  perform public.moderate_report(v_report_id,'pending_review','normal',null,null);
  perform public.moderate_report(v_report_id,'under_review','normal',null,null);
  perform public.moderate_report(v_report_id,'verified','normal',null,null);
  perform public.moderate_report(v_report_id,'in_progress','normal',null,null);
  perform public.moderate_report(v_report_id,'resolved','normal',null,'Fictional final feedback');
  execute 'reset role';

  select * into actual from public.reports where id=v_report_id;
  if actual.status<>'resolved' or not actual.is_public or actual.priority<>'normal'
    or actual.reviewed_by<>moderator or actual.reviewed_at is null
    or actual.verified_at is null or actual.resolved_at is null then
    raise exception 'TEST FAILED: moderation state did not persist inside isolated transaction';
  end if;
  select count(*) into audits from public.platform_audit where record_id=v_report_id;
  if audits<>9 then raise exception 'TEST FAILED: expected 9 successful moderation audits, got %',audits; end if;
  if not exists(select 1 from public.report_events e where e.report_id=v_report_id and status='needs_more_information' and note='Clarify fictional location')
    or not exists(select 1 from public.report_events e where e.report_id=v_report_id and status='rejected' and note='Fictional duplicate')
    or not exists(select 1 from public.report_events e where e.report_id=v_report_id and status='resolved' and note='Fictional final feedback') then
    raise exception 'TEST FAILED: per-event reasons were overwritten at equal transaction timestamps';
  end if;
  if (select count(*) from public.moderator_notes n where n.report_id=v_report_id)<>2 then
    raise exception 'TEST FAILED: private note persistence';
  end if;

  perform set_config('request.jwt.claim.sub',resident::text,true);
  execute 'set local role authenticated';
  select r.decision_note into result_note from public.my_reports() r where r.id=v_report_id;
  if result_note is distinct from 'Fictional final feedback' then raise exception 'TEST FAILED: own-report feedback'; end if;
  if exists(select 1 from public.moderator_notes n where n.report_id=v_report_id)
    or exists(select 1 from public.platform_audit a where a.record_id=v_report_id) then
    raise exception 'TEST FAILED: resident read private moderation data';
  end if;
  begin
    perform decision_note from public.reports where id=v_report_id;
    raise exception 'TEST FAILED: direct private-field read';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if exists(select 1 from public.my_reports() r where r.id=v_report_id) then raise exception 'TEST FAILED: another owner read feedback'; end if;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform reviewed_by from public.reports where id=v_report_id;
    raise exception 'TEST FAILED: anonymous reviewer identity read';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end $$;
rollback;
select json_build_object(
  'result','PASS: isolated moderator/resident/anonymous tests; all fixtures rolled back',
  'reports',(select count(*) from public.reports),
  'events',(select count(*) from public.report_events),
  'notes',(select count(*) from public.moderator_notes),
  'users',(select count(*) from auth.users),
  'audit_rows',(select count(*) from public.platform_audit)
) as verification;
