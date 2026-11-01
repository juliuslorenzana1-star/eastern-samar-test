-- Compatible with both the inspected production schema and the full local chain.
-- No external requests, paid integrations, bucket deletion, or existing-row changes.
begin;
create schema if not exists private;
revoke all on schema private from public;

create table private.evidence_upload_claims (
  object_path text primary key,
  report_id uuid not null references public.reports(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);
create index evidence_claims_user_time on private.evidence_upload_claims(user_id,created_at);
create index evidence_claims_report on private.evidence_upload_claims(report_id);
alter table private.evidence_upload_claims enable row level security;
revoke all on private.evidence_upload_claims from public,anon,authenticated,service_role;

-- Charge every accepted path the bucket maximum (5 MiB), not client-supplied
-- byte_size or mutable storage metadata. Legacy objects count too. Claims are
-- retained even after admin deletion: deleting objects cannot reset allowances.
create function private.authorize_evidence_upload(p_path text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target uuid;
  total_count bigint;
  user_count bigint;
  report_count bigint;
begin
  if actor is null or p_path is null or length(p_path)>160 or p_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    return false;
  end if;
  target := split_part(p_path,'/',1)::uuid;
  if not exists(select 1 from public.reports where id=target and reporter_id=actor) then return false; end if;
  -- Global serialization also covers parallel uploads from different accounts.
  perform pg_catalog.pg_advisory_xact_lock(735681002);
  if exists(select 1 from private.evidence_upload_claims where object_path=p_path and user_id=actor and report_id=target) then return true; end if;
  -- Existing pre-migration paths may be checked by Storage before a conflict.
  if exists(select 1 from storage.objects where bucket_id='report-evidence' and name=p_path) then return true; end if;
  select count(*),count(*) filter(where user_id=actor),count(*) filter(where report_id=target)
    into total_count,user_count,report_count
  from (
    select c.user_id,c.report_id from private.evidence_upload_claims c
    union all
    select r.reporter_id,r.id from storage.objects o
    left join public.reports r on r.id::text=split_part(o.name,'/',1)
    where o.bucket_id='report-evidence' and not exists(
      select 1 from private.evidence_upload_claims c where c.object_path=o.name)
  ) charged;
  if report_count>=3 then raise exception 'This report has reached its evidence limit (3 files).' using errcode='54000'; end if;
  if user_count>=20 then raise exception 'Your evidence allowance is full. Please contact a moderator.' using errcode='54000'; end if;
  if total_count>=100 then raise exception 'Evidence storage allowance is full. Please contact a moderator.' using errcode='54000'; end if;
  if (select count(*) from private.evidence_upload_claims where user_id=actor and created_at>clock_timestamp()-interval '24 hours')>=10 then
    raise exception 'Please wait before uploading more evidence (10 files per 24 hours).' using errcode='54000';
  end if;
  if (select count(*) from private.evidence_upload_claims where created_at>clock_timestamp()-interval '24 hours')>=50 then
    raise exception 'The daily evidence allowance is full. Please try again later.' using errcode='54000';
  end if;
  insert into private.evidence_upload_claims(object_path,report_id,user_id) values(p_path,target,actor);
  return true;
end;
$$;
revoke all on function private.authorize_evidence_upload(text) from public,anon,service_role;
grant usage on schema private to authenticated;
grant execute on function private.authorize_evidence_upload(text) to authenticated;
-- RESTRICTIVE combines with existing/future permissive policies using AND.
create policy evidence_upload_quota on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'report-evidence' or private.authorize_evidence_upload(name));
create policy evidence_no_overwrite on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'report-evidence') with check (bucket_id <> 'report-evidence');

-- Metadata cannot be used to create unlimited orphan rows or misstate ownership.
create function private.enforce_evidence_metadata() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); stored jsonb;
begin
  if actor is null or not exists(select 1 from public.reports where id=new.report_id and reporter_id=actor)
    or split_part(new.object_path,'/',1)<>new.report_id::text then
    raise exception 'Evidence must belong to your report.' using errcode='42501';
  end if;
  select metadata into stored from storage.objects where bucket_id='report-evidence' and name=new.object_path;
  if not found or stored->>'size' is null or stored->>'mimetype' is null then
    raise exception 'Upload the evidence file before saving its details.' using errcode='22023';
  end if;
  new.uploaded_by := actor;
  new.byte_size := (stored->>'size')::integer;
  new.content_type := stored->>'mimetype';
  new.created_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.enforce_evidence_metadata() from public,anon,authenticated,service_role;
create trigger evidence_metadata_guard before insert on public.report_evidence
for each row execute function private.enforce_evidence_metadata();

create index if not exists reports_quota_user_created on public.reports(reporter_id,created_at);
create index if not exists reports_quota_created on public.reports(created_at);
create function private.enforce_report_allowance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); stamp timestamptz;
begin
  if actor is null then raise exception 'Sign in to submit a report.' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(735681001);
  stamp := clock_timestamp();
  -- Do not let direct API clients backdate submissions to bypass rolling quotas.
  new.reporter_id := actor;
  new.created_at := stamp;
  new.updated_at := stamp;
  new.title := trim(new.title);
  new.description := trim(new.description);
  if exists(select 1 from public.reports where reporter_id=actor
    and lower(title)=lower(new.title) and lower(description)=lower(new.description)
    and municipality=new.municipality and category_slug=new.category_slug
    and created_at>stamp-interval '10 minutes') then
    raise exception 'This concern was already submitted recently. Check My submissions.' using errcode='23505';
  end if;
  if (select count(*) from public.reports where reporter_id=actor and created_at>stamp-interval '10 minutes')>=5 then
    raise exception 'Please wait before submitting more concerns (5 per 10 minutes).' using errcode='54000';
  end if;
  if (select count(*) from public.reports where reporter_id=actor and created_at>stamp-interval '24 hours')>=20 then
    raise exception 'Your daily report allowance is reached (20 per 24 hours). Please try again later.' using errcode='54000';
  end if;
  if (select count(*) from public.reports where created_at>stamp-interval '24 hours')>=200 then
    raise exception 'The daily report allowance is reached. Please try again later.' using errcode='54000';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_report_allowance() from public,anon,authenticated,service_role;
-- Runs before the existing input/default triggers, without replacing either.
create trigger aaa_reports_allowance before insert on public.reports
for each row execute function private.enforce_report_allowance();

-- External APIs require BOTH an explicit Edge secret and a separately approved
-- database switch. Neither is enabled by this migration. No browser can enable it.
create table private.external_api_controls (
  service text primary key check(service in ('ai','email')),
  enabled boolean not null default false
);
insert into private.external_api_controls(service) values('ai'),('email');
create table private.external_api_claims (
  id bigint generated always as identity primary key,
  service text not null references private.external_api_controls(service),
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp()
);
create index external_api_claims_time on private.external_api_claims(service,created_at);
create index external_api_claims_user_time on private.external_api_claims(service,user_id,created_at);
alter table private.external_api_controls enable row level security;
alter table private.external_api_claims enable row level security;
revoke all on private.external_api_controls,private.external_api_claims from public,anon,authenticated,service_role;

create function public.claim_external_api_usage(p_service text,p_user_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz;
begin
  if p_service is null or p_service not in ('ai','email') or p_user_id is null then return 'disabled'; end if;
  perform pg_catalog.pg_advisory_xact_lock(735681003);
  if not exists(select 1 from private.external_api_controls where service=p_service and enabled) then return 'disabled'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then return 'disabled'; end if;
  stamp := clock_timestamp();
  if (select count(*) from private.external_api_claims where service=p_service and created_at>stamp-interval '24 hours') >= (case when p_service='ai' then 20 else 100 end) then return 'rate_limited'; end if;
  if (select count(*) from private.external_api_claims where service=p_service and user_id=p_user_id and created_at>stamp-interval '24 hours') >= (case when p_service='ai' then 3 else 20 end) then return 'rate_limited'; end if;
  if p_service='email' and (select count(*) from private.external_api_claims where service='email' and user_id=p_user_id and created_at>stamp-interval '1 hour')>=10 then return 'rate_limited'; end if;
  insert into private.external_api_claims(service,user_id,created_at) values(p_service,p_user_id,stamp);
  return 'claimed';
end;
$$;
revoke all on function public.claim_external_api_usage(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_external_api_usage(text,uuid) to service_role;
-- Trigger helpers are internal, including on the legacy production schema.
-- PostgreSQL invokes attached triggers without granting browser EXECUTE rights.
do $$
declare helper record;
begin
  for helper in select p.oid::pg_catalog.regprocedure as signature
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype='pg_catalog.trigger'::pg_catalog.regtype
  loop
    execute pg_catalog.format('revoke all on function %s from public,anon,authenticated',helper.signature);
  end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
