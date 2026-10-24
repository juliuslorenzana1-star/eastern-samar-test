-- REVIEW BEFORE APPLYING. Generated for the inspected eastern-samar-test schema.
-- Production has manually provisioned base/volunteer tables but incomplete migration history.
-- Do not run all historical migrations blindly. This one-time transaction adds missing pieces.
begin;
do $$ begin
  if to_regclass('public.volunteer_registrations') is null
    or to_regprocedure('public.record_volunteer_attendance(uuid,text,numeric)') is null
    or to_regprocedure('public.join_volunteer_opportunity(uuid)') is null then
    raise exception 'Preflight failed: expected volunteer schema is missing';
  end if;
  if to_regclass('public.platform_audit') is not null then
    raise exception 'Repair already applied or schema differs. Review before retrying.';
  end if;
end $$;
-- Review-decision visibility for the resident who submitted a report.
--
-- Why this migration exists:
-- The submission guard (reports_submission_guard) already forces every new report
-- to status = 'pending_review' and is_public = false, and the reports_read policy
-- already hides anything that is not public. What was missing is the feedback loop:
-- the only place a decision reason could be written was public.moderator_notes,
-- which is staff-only by policy, so a resident could never learn that a report was
-- rejected, nor why. This adds a resident-facing reason plus the review audit
-- columns, and rewrites moderate_report() so the two kinds of note stay separate.
--
-- Nothing here changes how a report becomes public: is_public is still only ever
-- set by moderate_report(), which only public.is_staff() can execute.

alter table public.reports
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists decision_note text
    check (decision_note is null or char_length(decision_note) between 1 and 600);

comment on column public.reports.reviewed_by is 'Moderator account that last recorded a review decision. Never granted to anon.';
comment on column public.reports.reviewed_at is 'When the last review decision was recorded.';
comment on column public.reports.decision_note is 'Resident-facing reason for a rejection or a request for more information. Readable by the reporter and staff only through the reports_read policy; never granted to anon.';

-- Belt and braces: no client role may ever write review state directly.
-- Review state is only reachable through the moderate_report() RPC.
revoke update, delete, truncate on public.reports from anon, authenticated;


-- Replace the four-argument version with a five-argument version. Postgres keeps
-- overloads rather than replacing them, so the old signature is dropped first to
-- avoid an ambiguous call from PostgREST.
drop function if exists public.moderate_report(uuid, public.report_status, public.report_priority, text);

create or replace function public.moderate_report(
  target_report_id uuid,
  next_status public.report_status,
  next_priority public.report_priority,
  internal_note text default null,
  resident_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.reports;
  note_for_resident text;
  note_for_staff text;
begin
  -- Role comes from the server-side profile row, never from the request body.
  if not public.is_staff() then
    raise exception 'Moderator access is required' using errcode = '42501';
  end if;

  select * into target from public.reports where id = target_report_id;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  note_for_resident := nullif(trim(coalesce(resident_note, '')), '');
  note_for_staff := nullif(trim(coalesce(internal_note, '')), '');

  -- A resident must never see a bare "Rejected" with no explanation, and a
  -- report sent back for more information must say what is missing.
  if next_status in ('rejected', 'needs_more_information') and note_for_resident is null then
    raise exception 'Add a short reason for the reporter before rejecting or requesting more information.'
      using errcode = '22023';
  end if;

  -- A rejected report has to go back through review before it can be published
  -- again, so one careless click cannot move a rejected report onto the public map.
  if target.status = 'rejected'
    and next_status in ('approved', 'verified', 'in_progress', 'resolved')
    and not public.is_admin()
  then
    raise exception 'A rejected report must return to review before it can be published.'
      using errcode = '42501';
  end if;

  update public.reports
     set status = next_status,
         priority = next_priority,
         is_public = next_status in ('approved', 'verified', 'in_progress', 'resolved'),
         verified_at = case when next_status = 'verified' then now() else verified_at end,
         resolved_at = case when next_status = 'resolved' then now() else null end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         decision_note = left(note_for_resident, 600)
   where id = target_report_id;

  -- Keep the resident-facing reason on the status event that recorded this change.
  if target.status is distinct from next_status then
    update public.report_events
       set note = left(note_for_resident, 600)
     where id = (
       select event.id from public.report_events event
       where event.report_id = target_report_id
       order by event.created_at desc, event.id desc
       limit 1
     );
  end if;

  -- Internal notes stay in their own staff-only table and are never merged into
  -- decision_note, so nothing internal can leak to a resident through a read.
  if note_for_staff is not null then
    insert into public.moderator_notes (report_id, moderator_id, note)
    values (target_report_id, auth.uid(), left(note_for_staff, 4000));
  end if;
end;
$$;

revoke all on function public.moderate_report(uuid, public.report_status, public.report_priority, text, text)
  from public, anon;
grant execute on function public.moderate_report(uuid, public.report_status, public.report_priority, text, text)
  to authenticated;

-- decision_note and reviewed_at stay readable (RLS decides who); reviewed_by is
-- deliberately not granted so a moderator account id is never returned to a client.
grant select (decision_note, reviewed_at) on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Fix for "permission denied for table reports" for a signed-in resident
-- ---------------------------------------------------------------------------
-- The initial migration grants SELECT on public.reports column by column:
--   grant select (id, title, description, category_slug, municipality, barangay,
--     latitude, longitude, incident_at, needed_by, priority, status, is_public,
--     created_at, updated_at, verified_at, resolved_at) on public.reports to anon, authenticated;
-- reporter_id is NOT in that list. PostgreSQL enforces SELECT privileges on
-- columns used in WHERE too, so a client-side filter such as
--   GET /rest/v1/reports?reporter_id=eq.<uid>&select=...
-- is rejected with 42501 "permission denied for table reports" before RLS ever
-- runs. That is a privilege error, not a policy error, which is why no policy
-- change can fix it.
--
-- This function does the same job inside the database: it runs as the table owner
-- (so the missing column grant is irrelevant) and applies the auth.uid() filter
-- itself, so a client never has to name reporter_id. It returns exactly the
-- caller's own rows and nothing else.
create or replace function public.my_reports()
returns table (
  id uuid,
  title text,
  description text,
  category_slug text,
  municipality text,
  barangay text,
  latitude double precision,
  longitude double precision,
  incident_at timestamptz,
  needed_by date,
  priority public.report_priority,
  status public.report_status,
  is_public boolean,
  created_at timestamptz,
  updated_at timestamptz,
  verified_at timestamptz,
  resolved_at timestamptz,
  decision_note text,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.description, r.category_slug, r.municipality, r.barangay,
         r.latitude, r.longitude, r.incident_at, r.needed_by,
         r.priority, r.status, r.is_public,
         r.created_at, r.updated_at, r.verified_at, r.resolved_at,
         r.decision_note, r.reviewed_at
  from public.reports r
  where r.reporter_id = auth.uid()
  order by r.created_at desc
  limit 100;
$$;

comment on function public.my_reports() is 'Returns the signed-in caller''s own reports, including the resident-facing review reason. Filtered by auth.uid() and runs as the table owner so the column-level SELECT grant on reporter_id is not needed.';

revoke all on function public.my_reports() from public, anon;
grant execute on function public.my_reports() to authenticated;

-- Bridge for the bundle that is already deployed: that build still asks the
-- database for reporter_id, so it keeps failing with 42501 until this grant
-- exists. The exposure is limited: RLS (reports_read_owner_staff_or_public) still
-- decides which ROWS a caller can see, and this only reveals the reporter's UUID
-- for rows they may already read -- their own reports plus published ones. No
-- name, email, or phone is reachable through it. Once the build that calls
-- public.my_reports() is live, this grant can be withdrawn with:
--   revoke select (reporter_id) on public.reports from authenticated;
grant select (reporter_id) on public.reports to authenticated;

-- Make the running PostgREST instance pick up the new columns and the new
-- function at once. Without this, the API can keep answering "Could not find the
-- 'decision_note' column" (PGRST202/204) against its cached schema for a while
-- even though the SQL above has already committed.
notify pgrst, 'reload schema';

alter table public.profiles add column if not exists show_on_leaderboard boolean not null default false;
grant update(show_on_leaderboard) on public.profiles to authenticated;
create table if not exists public.ai_review_runs (
  report_id uuid primary key references public.reports(id) on delete cascade,
  status text not null check(status in ('pending','completed','unavailable','failed')),
  model_name text,checked_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.ai_review_runs enable row level security;
revoke all on public.ai_review_runs from anon,authenticated;
grant select on public.ai_review_runs to authenticated;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='ai_review_runs' and policyname='ai_review_runs_staff_read') then
    create policy ai_review_runs_staff_read on public.ai_review_runs for select to authenticated using(public.is_staff());
  end if;
end $$;
-- Additive repair. Apply earlier repository migrations first. No records removed.

revoke select (reporter_id) on public.reports from anon;
-- Owner history now uses my_reports(); authenticated grant retained for older clients.
grant select on public.profiles to authenticated;

alter table public.reports
  add column verification_status text not null default 'pending_review'
    check (verification_status in ('pending_review','under_review','needs_more_information','approved','verified','rejected')),
  add column resolution_status text not null default 'open'
    check (resolution_status in ('open','in_progress','resolved'));

create function public.sync_report_lifecycle() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.verification_status := case
    when new.status in ('in_progress','resolved') then case when new.verified_at is not null then 'verified' else 'approved' end
    else new.status::text end;
  new.resolution_status := case when new.status in ('in_progress','resolved') then new.status::text else 'open' end;
  return new;
end;
$$;
-- Alphabetically after submission defaults, so submitted values cannot override review.
create trigger zz_reports_lifecycle before insert or update on public.reports
for each row execute function public.sync_report_lifecycle();
alter table public.reports disable trigger reports_touch_updated_at;
update public.reports set verification_status = case
  when status in ('in_progress','resolved') then case when verified_at is not null then 'verified' else 'approved' end
  else status::text end,
  resolution_status = case when status in ('in_progress','resolved') then status::text else 'open' end;
alter table public.reports enable trigger reports_touch_updated_at;
create index reports_public_created_idx on public.reports(created_at desc) where is_public;
-- Cover the foreign-key lookups identified by the read-only performance audit.
create index if not exists ai_flags_report_idx on public.ai_review_flags(report_id);
create index if not exists projects_creator_idx on public.community_projects(created_by);
create index if not exists moderator_notes_actor_idx on public.moderator_notes(moderator_id);
create index if not exists moderator_notes_report_idx on public.moderator_notes(report_id,created_at);
create index if not exists report_matches_target_idx on public.possible_report_matches(possible_match_id);
create index if not exists report_matches_reviewer_idx on public.possible_report_matches(reviewed_by);
create index if not exists report_events_actor_idx on public.report_events(actor_id);
create index if not exists evidence_report_idx on public.report_evidence(report_id);
create index if not exists evidence_uploader_idx on public.report_evidence(uploaded_by);
create index if not exists reports_category_idx on public.reports(category_slug);
create index if not exists notifications_report_idx on public.user_notifications(report_id);
create index if not exists opportunities_creator_idx on public.volunteer_opportunities(created_by);
create index if not exists opportunities_organizer_idx on public.volunteer_opportunities(organizer_id);
create index if not exists opportunities_project_idx on public.volunteer_opportunities(project_id);
create index if not exists legacy_signups_user_idx on public.volunteer_signups(user_id);
-- Statement-scoped role checks preserve the existing authorization semantics.
alter policy reports_read_owner_staff_or_public on public.reports using (
  reporter_id=(select auth.uid()) or (select public.is_staff())
  or (is_public and status in ('approved','verified','in_progress','resolved'))
);
alter policy profiles_read_self_or_staff on public.profiles using(id=(select auth.uid()) or (select public.is_staff()));
grant select (verification_status,resolution_status) on public.reports to anon, authenticated;

create function public.guard_report_submission() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in to submit a report.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 19));
  new.title := trim(new.title);
  new.description := trim(new.description);
  if new.municipality not in ('Arteche','Balangiga','Balangkayan','Borongan City','Can-avid','Dolores','General MacArthur','Giporlos','Guiuan','Hernani','Jipapad','Lawaan','Llorente','Maslog','Maydolong','Mercedes','Oras','Quinapondan','Salcedo','San Julian','San Policarpo','Sulat','Taft') then
    raise exception 'Choose an Eastern Samar municipality.' using errcode='22023';
  end if;
  if not exists(select 1 from public.report_categories where slug=new.category_slug and active) then
    raise exception 'Choose an active category.' using errcode='22023';
  end if;
  if (new.latitude is null) <> (new.longitude is null) or
     (new.latitude is not null and not (new.latitude between 10.687949282 and 12.349578051 and new.longitude between 125.125405412 and 125.969094646)) then
    raise exception 'Location must be within the province map extent.' using errcode='22023';
  end if;
  if exists(select 1 from public.reports where reporter_id=auth.uid()
    and lower(title)=lower(new.title) and lower(description)=lower(new.description)
    and municipality=new.municipality and category_slug=new.category_slug
    and created_at > now()-interval '10 minutes') then
    raise exception 'This concern was already submitted recently. Check My submissions.' using errcode='23505';
  end if;
  if (select count(*) from public.reports where reporter_id=auth.uid() and created_at>now()-interval '10 minutes') >= 5 then
    raise exception 'Please wait before submitting more concerns.' using errcode='54000';
  end if;
  return new;
end;
$$;
-- Validate before rounding coordinates in reports_submission_guard.
create trigger reports_input_guard before insert on public.reports
for each row execute function public.guard_report_submission();

create function public.report_progress(target_report_id uuid)
returns table (id uuid,status public.report_status,created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id,e.status,e.created_at
  from public.report_events e join public.reports r on r.id=e.report_id
  where r.id=target_report_id and (
    (auth.uid() is not null and (r.reporter_id=auth.uid() or public.is_staff()))
    or (r.is_public and r.status in ('approved','verified','in_progress','resolved')
      and e.status in ('approved','verified','in_progress','resolved')))
  order by e.created_at,e.id;
$$;
revoke all on function public.report_progress(uuid) from public;
grant execute on function public.report_progress(uuid) to anon,authenticated;

-- Explicit public alias; never publish the account profile name implicitly.
alter table public.profiles add column if not exists public_alias text
  check (public_alias is null or char_length(trim(public_alias)) between 1 and 80);
grant update (public_alias) on public.profiles to authenticated;
create or replace function public.get_public_leaderboard()
returns table (rank bigint,display_name text,community_hours numeric,volunteer_activities bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  with totals as (
    select p.id,p.public_alias as display_name,
      sum(r.volunteer_hours) filter(where r.status in ('attended','completed'))::numeric as community_hours,
      count(distinct r.opportunity_id) filter(where r.status='completed') as volunteer_activities
    from public.profiles p join public.volunteer_registrations r on r.volunteer_id=p.id
    where p.show_on_leaderboard and nullif(trim(p.public_alias),'') is not null
    group by p.id,p.public_alias
    having sum(r.volunteer_hours) filter(where r.status in ('attended','completed'))>0
  ) select dense_rank() over(order by community_hours desc),display_name,community_hours,volunteer_activities
    from totals order by community_hours desc,display_name;
$$;
revoke all on function public.get_public_leaderboard() from public;
grant execute on function public.get_public_leaderboard() to anon,authenticated;

create table public.platform_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity text not null,
  record_id uuid not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index audit_actor_created_idx on public.platform_audit(actor_id,created_at desc);
create index audit_record_idx on public.platform_audit(entity,record_id,created_at desc);
alter table public.platform_audit enable row level security;
revoke all on public.platform_audit from anon,authenticated;
grant select on public.platform_audit to authenticated;
create policy audit_staff_read on public.platform_audit for select to authenticated using(public.is_staff());
create function public.audit_platform_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.platform_audit(actor_id,entity,record_id,changes)
    values(auth.uid(),tg_table_name,new.id,
      case when tg_table_name='profiles' then jsonb_build_object('old_role',to_jsonb(old)->'role','new_role',to_jsonb(new)->'role')
      else jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)) end);
  return new;
end;
$$;
create trigger audit_role after update of role on public.profiles for each row
when(old.role is distinct from new.role) execute function public.audit_platform_change();
create trigger audit_attendance after update on public.volunteer_registrations for each row
when(old is distinct from new) execute function public.audit_platform_change();
create trigger audit_report_change after update on public.reports for each row
when(old is distinct from new) execute function public.audit_platform_change();

-- Trigger functions cannot be used as API entrypoints. Intentional role/aggregate
-- RPCs keep their explicit grants because policies and public totals depend on them.
do $$ declare routine record; begin
  for routine in select oid::regprocedure signature from pg_proc
    where pronamespace='public'::regnamespace and prorettype='trigger'::regtype
  loop execute format('revoke all on function %s from public,anon,authenticated',routine.signature); end loop;
end $$;
-- Durable email idempotency and per-account rate limit. Only the trusted edge
create function public.platform_statistics()
returns table(total_reports bigint,pending_reports bigint,verified_reports bigint,resolved_reports bigint,active_volunteers bigint,completed_activities bigint,verified_hours numeric,municipalities_reached bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  with visible_reports as (
    select * from public.reports where public.is_staff() or (is_public and status in ('approved','verified','in_progress','resolved'))
  ), visible_activities as (
    select * from public.volunteer_opportunities o where status in ('published','active','open','full','ongoing','completed','cancelled')
    and (report_id is null or exists(select 1 from public.reports r where r.id=o.report_id and r.is_public and r.status in ('approved','verified','in_progress','resolved')))
  )
  select (select count(*) from visible_reports),
    case when public.is_staff() then (select count(*) from visible_reports where status in ('pending_review','under_review','needs_more_information')) else null end,
    (select count(*) from visible_reports where verification_status='verified'),
    (select count(*) from visible_reports where resolution_status='resolved'),
    (select count(distinct volunteer_id) from public.volunteer_registrations r join visible_activities o on o.id=r.opportunity_id where r.status='registered' and o.status not in ('completed','cancelled')),
    (select count(*) from visible_activities where status='completed'),
    (select coalesce(sum(r.volunteer_hours),0)::numeric from public.volunteer_registrations r join visible_activities o on o.id=r.opportunity_id where r.status in ('attended','completed')),
    (select count(distinct municipality) from visible_reports);
$$;
revoke all on function public.platform_statistics() from public;
grant execute on function public.platform_statistics() to anon,authenticated;

-- Durable email idempotency and per-account rate limit. Only the trusted edge
-- function's service role may reserve notifications.
create table public.email_notification_log (
  notification_type text not null check(notification_type in ('report_submission','volunteer_registration')),
  reference_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'reserved' check(status in ('reserved','accepted','failed','uncertain')),
  provider_id text,
  created_at timestamptz not null default now(),
  primary key(notification_type,reference_id)
);
create index email_notification_user_time on public.email_notification_log(user_id,created_at);
alter table public.email_notification_log enable row level security;
revoke all on public.email_notification_log from public,anon,authenticated;
grant select,insert,update on public.email_notification_log to service_role;
create function public.claim_email_notification(p_user_id uuid,p_type text,p_reference uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare existing_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select status into existing_status from public.email_notification_log where notification_type=p_type and reference_id=p_reference;
  if found then return existing_status; end if;
  if (select count(*) from public.email_notification_log where user_id=p_user_id and created_at>now()-interval '1 hour')>=10 then return 'rate_limited'; end if;
  insert into public.email_notification_log(notification_type,reference_id,user_id) values(p_type,p_reference,p_user_id);
  return 'claimed';
end;
$$;
revoke all on function public.claim_email_notification(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_email_notification(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';

commit;
