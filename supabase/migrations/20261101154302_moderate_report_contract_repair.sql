-- Narrow repair for the inspected legacy production schema. No historical
-- migration replay, record backfill, Auth role changes or provider activation.
-- Privileged RPC review: see MODERATION_RPC_REPAIR.md before applying.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='moderate_report'
      and p.oid not in (
        coalesce(pg_catalog.to_regprocedure('public.moderate_report(uuid,public.report_status,public.report_priority,text)')::oid,0::oid),
        coalesce(pg_catalog.to_regprocedure('public.moderate_report(uuid,public.report_status,public.report_priority,text,text)')::oid,0::oid)
      )
  ) then raise exception 'Unexpected moderate_report overload; inspect before repairing.'; end if;
end $$;

alter table public.reports
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists decision_note text
    check(decision_note is null or char_length(decision_note) between 1 and 600);

-- Reuse the platform audit schema from platform_completion when it is present.
-- Only the moderation RPC writes this audit on legacy databases lacking its
-- general audit trigger. Never install a duplicate general-purpose audit trigger.
create table if not exists public.platform_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity text not null,
  record_id uuid not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_actor_created_idx on public.platform_audit(actor_id,created_at desc);
create index if not exists audit_record_idx on public.platform_audit(entity,record_id,created_at desc);
alter table public.platform_audit enable row level security;
revoke all on public.platform_audit from public,anon,authenticated;
grant select on public.platform_audit to authenticated;
do $$ begin
  if not exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='platform_audit' and policyname='audit_staff_read') then
    create policy audit_staff_read on public.platform_audit for select to authenticated using(public.is_staff());
  end if;
end $$;

-- Adding columns must not inherit legacy table-wide SELECT grants. Public
-- clients cannot read moderator IDs or resident-facing reasons on public rows.
revoke select on public.reports from anon,authenticated;
revoke select(reviewed_by,reviewed_at,decision_note,reporter_id) on public.reports from anon,authenticated;
grant select(id,title,description,category_slug,municipality,barangay,latitude,longitude,
  incident_at,needed_by,priority,status,is_public,created_at,updated_at,verified_at,resolved_at)
  on public.reports to anon,authenticated;
-- Existing authenticated ownership filters / event RLS subqueries depend on this
-- legacy column grant. No new identity privilege is introduced by this repair.
grant select(reporter_id) on public.reports to authenticated;
do $$ declare field text; begin
  foreach field in array array['verification_status','resolution_status'] loop
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name=field) then
      execute pg_catalog.format('grant select(%I) on public.reports to anon,authenticated',field);
    end if;
  end loop;
end $$;
revoke update,delete,truncate on public.reports from anon,authenticated;

-- Replace the legacy signature, not a second ambiguous overload. No CASCADE.
drop function if exists public.moderate_report(uuid,public.report_status,public.report_priority,text);
create or replace function public.moderate_report(
  target_report_id uuid,
  next_status public.report_status,
  next_priority public.report_priority,
  internal_note text default null,
  resident_note text default null
)
returns void language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := auth.uid();
  actor_role public.app_role;
  target public.reports;
  note_for_resident text := nullif(pg_catalog.btrim(coalesce(resident_note,'')),'');
  note_for_staff text := nullif(pg_catalog.btrim(coalesce(internal_note,'')),'');
  previous_events uuid[];
begin
  -- Authorize before even looking up the report. The protected database profile
  -- is authoritative; user-editable JWT metadata is never trusted. Share-lock
  -- the role row so a concurrent admin revocation cannot race this decision.
  if actor is null then
    raise exception 'Moderator access is required' using errcode='42501';
  end if;
  select p.role into actor_role from public.profiles p where p.id=actor for share;
  if actor_role is null or actor_role not in ('moderator','admin') then
    raise exception 'Moderator access is required' using errcode='42501';
  end if;
  if target_report_id is null or next_status is null or next_priority is null then
    raise exception 'Report, status and priority are required.' using errcode='22023';
  end if;
  select * into target from public.reports where id=target_report_id for update;
  if not found then raise exception 'Report not found' using errcode='P0002'; end if;
  if next_status in ('rejected','needs_more_information') and note_for_resident is null then
    raise exception 'Add a short reason for the reporter before rejecting or requesting more information.' using errcode='22023';
  end if;
  if target.status='rejected' and next_status in ('approved','verified','in_progress','resolved') and actor_role<>'admin' then
    raise exception 'A rejected report must return to review before it can be published.' using errcode='42501';
  end if;

  select coalesce(pg_catalog.array_agg(e.id),array[]::uuid[]) into previous_events
    from public.report_events e where e.report_id=target_report_id;
  update public.reports
    set status=next_status,priority=next_priority,
        is_public=next_status in ('approved','verified','in_progress','resolved'),
        verified_at=case when next_status='verified' then pg_catalog.now() else verified_at end,
        resolved_at=case when next_status='resolved' then pg_catalog.now() else null end,
        reviewed_by=actor,reviewed_at=pg_catalog.now(),
        decision_note=pg_catalog.left(note_for_resident,600)
    where id=target_report_id;

  -- Annotate only the event created by the existing status trigger. Comparing
  -- UUID sets is deliberate: several transitions can have identical now() values
  -- in one transaction; ordering random UUIDs does not identify the latest event.
  if target.status is distinct from next_status then
    update public.report_events set note=pg_catalog.left(note_for_resident,600)
      where report_id=target_report_id and not(id=any(previous_events))
        and actor_id=actor and status=next_status;
  end if;
  if note_for_staff is not null then
    insert into public.moderator_notes(report_id,moderator_id,note)
      values(target_report_id,actor,pg_catalog.left(note_for_staff,4000));
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid=t.tgfoid
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where t.tgrelid='public.reports'::regclass and t.tgname='audit_report_change'
      and t.tgenabled in ('O','A') and n.nspname='public' and p.proname='audit_platform_change'
  ) then
    insert into public.platform_audit(actor_id,entity,record_id,changes)
      values(actor,'reports',target_report_id,pg_catalog.jsonb_build_object(
        'before',pg_catalog.jsonb_build_object('status',target.status,'priority',target.priority,'is_public',target.is_public),
        'after',pg_catalog.jsonb_build_object('status',next_status,'priority',next_priority,'is_public',next_status in ('approved','verified','in_progress','resolved')),
        'internal_note_added',note_for_staff is not null,'resident_note_recorded',note_for_resident is not null));
  end if;
end;
$$;
alter function public.moderate_report(uuid,public.report_status,public.report_priority,text,text) owner to postgres;
revoke all on function public.moderate_report(uuid,public.report_status,public.report_priority,text,text) from public,anon,authenticated,service_role;
grant execute on function public.moderate_report(uuid,public.report_status,public.report_priority,text,text) to authenticated;

-- Existing frontend already calls this owner-filtered endpoint. Resident reasons
-- cannot safely be granted directly on reports because published rows are shared.
create or replace function public.my_reports()
returns table(id uuid,title text,description text,category_slug text,municipality text,barangay text,
  latitude double precision,longitude double precision,incident_at timestamptz,needed_by date,
  priority public.report_priority,status public.report_status,is_public boolean,
  created_at timestamptz,updated_at timestamptz,verified_at timestamptz,resolved_at timestamptz,
  decision_note text,reviewed_at timestamptz)
language sql stable security definer set search_path=''
as $$
  select r.id,r.title,r.description,r.category_slug,r.municipality,r.barangay,
    r.latitude,r.longitude,r.incident_at,r.needed_by,r.priority,r.status,r.is_public,
    r.created_at,r.updated_at,r.verified_at,r.resolved_at,r.decision_note,r.reviewed_at
  from public.reports r where r.reporter_id=auth.uid() and auth.uid() is not null
  order by r.created_at desc limit 100;
$$;
alter function public.my_reports() owner to postgres;
revoke all on function public.my_reports() from public,anon,authenticated,service_role;
grant execute on function public.my_reports() to authenticated;
notify pgrst,'reload schema';
