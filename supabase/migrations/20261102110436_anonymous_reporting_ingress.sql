-- Visitor ingress is service-only. Browser roles retain existing RLS/grants.
-- No existing rows are changed. See ANONYMOUS_REPORTING_IMPLEMENTATION.md.
begin;
do $$ begin
  if not exists(select 1 from storage.buckets where id='report-evidence' and public=false
    and file_size_limit between 2097152 and 5242880
    and 'image/jpeg'=any(allowed_mime_types)
    and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]) then
    raise exception 'Review private evidence bucket restrictions before enabling visitor reports';
  end if;
end $$;
create schema if not exists private;
create table private.visitor_reports (
  report_id uuid primary key references public.reports(id) on delete cascade deferrable initially deferred,
  tracking_hash text not null unique check(tracking_hash ~ '^[a-f0-9]{64}$'),
  source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
  payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
  contact jsonb not null default '{}' check(jsonb_typeof(contact)='object'),
  object_path text unique,
  created_at timestamptz not null default clock_timestamp()
);
create table private.visitor_write_context (
  report_id uuid primary key,
  transaction_id bigint not null
);
create table private.visitor_attempts (
  source_hash text not null,
  operation text not null check(operation in ('submit','track')),
  window_start timestamptz not null,
  attempts integer not null default 1,
  primary key(source_hash,operation,window_start)
);
alter table private.visitor_reports enable row level security;
alter table private.visitor_write_context enable row level security;
alter table private.visitor_attempts enable row level security;
create index visitor_reports_source_time on private.visitor_reports(source_hash,created_at);
create index visitor_attempts_operation_time on private.visitor_attempts(operation,window_start);
create index visitor_attempts_source_time on private.visitor_attempts(source_hash,operation,window_start);
revoke all on private.visitor_reports,private.visitor_write_context,private.visitor_attempts from public,anon,authenticated,service_role;

create function private.visitor_write_allowed(target uuid) returns boolean
language sql volatile security definer set search_path='' as $$
  select auth.uid() is null and exists(select 1 from private.visitor_write_context
    where report_id=target and transaction_id=pg_catalog.txid_current());
$$;
revoke all on function private.visitor_write_allowed(uuid) from public,anon,authenticated,service_role;
alter function private.visitor_write_allowed(uuid) owner to postgres;

-- Preserve the existing authenticated guard implementations verbatim, adding
-- only an early branch backed by a private transaction-bound ingress record.
-- Abort instead of silently modifying an unexpected deployment definition.
do $$
declare definition text;
begin
  definition:=pg_catalog.pg_get_functiondef('public.set_report_defaults_and_location_precision()'::regprocedure);
  if definition not like '%new.reporter_id := auth.uid();%' then raise exception 'Inspect report default guard before migration'; end if;
  definition:=regexp_replace(definition,'begin',E'begin\n  if private.visitor_write_allowed(new.id) then\n    new.reporter_id:=null; new.status:=\x27pending_review\x27; new.is_public:=false; new.verified_at:=null; new.resolved_at:=null;\n    if new.latitude is not null then new.latitude:=round(new.latitude::numeric,2)::double precision; new.longitude:=round(new.longitude::numeric,2)::double precision; end if;\n    return new;\n  end if;', 'i');
  execute definition;
  definition:=pg_catalog.pg_get_functiondef('private.enforce_report_allowance()'::regprocedure);
  if definition not like '%actor is null%' then raise exception 'Inspect report allowance before migration'; end if;
  definition:=regexp_replace(definition,'begin',E'begin\n  if private.visitor_write_allowed(new.id) then new.reporter_id:=null; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new; end if;', 'i');
  execute definition;
  if pg_catalog.to_regprocedure('public.guard_report_submission()') is not null then
    definition:=pg_catalog.pg_get_functiondef('public.guard_report_submission()'::regprocedure);
    if definition not like '%Sign in to submit a report%' then raise exception 'Inspect extra report guard before migration'; end if;
    definition:=regexp_replace(definition,'begin',E'begin\n  if private.visitor_write_allowed(new.id) then return new; end if;', 'i');
    execute definition;
  end if;
  definition:=pg_catalog.pg_get_functiondef('private.enforce_evidence_metadata()'::regprocedure);
  if definition not like '%Evidence must belong to your report%' then raise exception 'Inspect evidence guard before migration'; end if;
  definition:=regexp_replace(definition,'begin',E'begin\n  if private.visitor_write_allowed(new.report_id) and exists(select 1 from private.visitor_reports v where v.report_id=new.report_id and v.object_path=new.object_path) then\n    select metadata into stored from storage.objects where bucket_id=\x27report-evidence\x27 and name=new.object_path;\n    if stored is null then raise exception \x27Upload is not complete\x27; end if;\n    new.uploaded_by:=null; new.byte_size:=(stored->>\x27size\x27)::integer; new.content_type:=stored->>\x27mimetype\x27; new.created_at:=clock_timestamp(); return new;\n  end if;', 'i');
  execute definition;
  definition:=pg_catalog.pg_get_functiondef('private.authorize_evidence_upload(text)'::regprocedure);
  if definition not like '%if report_count>=3%' then raise exception 'Inspect upload allowance before migration'; end if;
  definition:=replace(definition,'if report_count>=3', E'total_count:=total_count+(select count(*) from private.visitor_reports v where v.object_path is not null and not exists(select 1 from storage.objects o where o.bucket_id=\x27report-evidence\x27 and o.name=v.object_path));\n  if report_count>=3');
  execute definition;
end $$;
alter function public.set_report_defaults_and_location_precision() set search_path='';
alter function private.enforce_report_allowance() set search_path='';
do $$ begin
  if pg_catalog.to_regprocedure('public.guard_report_submission()') is not null then
    alter function public.guard_report_submission() set search_path='';
  end if;
end $$;
alter table public.reports alter column reporter_id drop not null;
alter table public.report_evidence alter column uploaded_by drop not null;

-- Authenticated callers need reporter_id for legacy ownership policies, but
-- must not enumerate other reporters through published rows. Public map reads
-- use this deliberately bounded owner-executed projection instead.
create policy reports_private_authenticated_read on public.reports as restrictive
for select to authenticated using(reporter_id=(select auth.uid()) or (select public.is_staff()));
create view public.public_report_feed with (security_barrier=true,security_invoker=false) as
select id,title,description,category_slug,municipality,barangay,latitude,longitude,
  incident_at,needed_by,priority,status,is_public,created_at,updated_at,verified_at,resolved_at
from public.reports where is_public and status in ('approved','verified','in_progress','resolved');
alter view public.public_report_feed owner to postgres;
revoke all on public.public_report_feed from public,anon,authenticated;
grant select on public.public_report_feed to anon,authenticated;

-- Finite counters, including unsuccessful requests, committed in a separate
-- RPC before parsing/decoding images. Limits are deliberately conservative.
create function public.claim_visitor_attempt(source text, operation text) returns boolean
language plpgsql security definer set search_path='' as $$

#variable_conflict use_column
declare stamp timestamptz:=clock_timestamp(); total integer; local_count integer; ceiling integer;
begin
  if source is null or source !~ '^[a-f0-9]{64}$' or operation not in ('submit','track') or operation is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(735681003);
  ceiling:=case when operation='submit' then 5 else 30 end;
  select coalesce(sum(attempts),0) into total from private.visitor_attempts a
    where a.operation=claim_visitor_attempt.operation and a.window_start>stamp-interval '24 hours 1 minute';
  select coalesce(sum(attempts),0) into local_count from private.visitor_attempts a
    where a.operation=claim_visitor_attempt.operation and a.source_hash=source and a.window_start>stamp-interval '11 minutes';
  if total>=(case when operation='submit' then 400 else 3000 end) or local_count>=ceiling then return false; end if;
  if (select count(*) from private.visitor_attempts)>=100000 then return false; end if;
  insert into private.visitor_attempts(source_hash,operation,window_start)
    values(source,operation,date_trunc('minute',stamp))
    on conflict(source_hash,operation,window_start) do update set attempts=private.visitor_attempts.attempts+1;
  return true;
end $$;

create function public.submit_visitor_report(payload jsonb, tracking_hash text, source_hash text, payload_hash text, has_photo boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid:=gen_random_uuid(); previous private.visitor_reports%rowtype; contact jsonb; lat double precision; lng double precision; stamp timestamptz:=clock_timestamp();
begin
  if tracking_hash is null or tracking_hash !~ '^[a-f0-9]{64}$' or source_hash is null or source_hash !~ '^[a-f0-9]{64}$' or payload_hash is null or payload_hash !~ '^[a-f0-9]{64}$' or has_photo is null then raise exception 'Invalid submission' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(735681001);
  perform pg_catalog.pg_advisory_xact_lock(735681002);
  select * into previous from private.visitor_reports v where v.tracking_hash=submit_visitor_report.tracking_hash;
  if found then
    if previous.payload_hash<>submit_visitor_report.payload_hash then raise exception 'Tracking credential already used for different details' using errcode='22023'; end if;
    return jsonb_build_object('id',previous.report_id,'objectPath',previous.object_path,'replayed',true);
  end if;
  if jsonb_typeof(payload)<>'object' or length(trim(coalesce(payload->>'title',''))) not between 6 and 120
    or length(trim(coalesce(payload->>'description',''))) not between 12 and 4000
    or length(coalesce(payload->>'barangay',''))>100
    or coalesce(payload->>'priority','') not in ('low','normal','high','urgent')
    or not exists(select 1 from public.report_categories where slug=payload->>'category' and active)
    then raise exception 'Invalid report fields' using errcode='22023'; end if;
  if coalesce(payload->>'municipality','') not in ('Arteche','Balangiga','Balangkayan','Borongan City','Can-avid','Dolores','General MacArthur','Giporlos','Guiuan','Hernani','Jipapad','Lawaan','Llorente','Maslog','Maydolong','Mercedes','Oras','Quinapondan','Salcedo','San Julian','San Policarpo','Sulat','Taft') then raise exception 'Invalid municipality' using errcode='22023'; end if;
  contact:=coalesce(payload->'contact','{}'::jsonb);
  if jsonb_typeof(contact)<>'object' or length(coalesce(contact->>'name',''))>100 or length(coalesce(contact->>'email',''))>254 or length(coalesce(contact->>'phone',''))>32
    or exists(select 1 from jsonb_object_keys(contact) k where k not in ('name','email','phone')) then raise exception 'Invalid optional contact' using errcode='22023'; end if;
  if payload->'location' is not null and payload->'location'<>'null'::jsonb then
    lat:=(payload->'location'->>'lat')::double precision; lng:=(payload->'location'->>'lng')::double precision;
    if lat is null or lng is null or not(lat between 10.687949282 and 12.349578051 and lng between 125.125405412 and 125.969094646) then raise exception 'Invalid location' using errcode='22023'; end if;
  end if;
  if (select count(*) from public.reports where created_at>stamp-interval '24 hours')>=200
    or (select count(*) from private.visitor_reports where created_at>stamp-interval '24 hours' and visitor_reports.source_hash=submit_visitor_report.source_hash)>=20
    or (select count(*) from private.visitor_reports)>=500 then raise exception 'Report allowance reached' using errcode='54000'; end if;
  -- Reserve at most one 2 MiB image per report, including failed/orphaned uploads.
  -- Include existing account upload claims and pre-existing bucket objects.
  if has_photo and not exists(select 1 from storage.buckets where id='report-evidence' and public=false) then raise exception 'Private evidence storage unavailable' using errcode='54000'; end if;
  if has_photo and (
    (select count(*) from private.visitor_reports where object_path is not null)
    +(select count(*) from private.evidence_upload_claims)
    +(select count(*) from storage.objects o where bucket_id='report-evidence' and not exists(select 1 from private.evidence_upload_claims c where c.object_path=o.name) and not exists(select 1 from private.visitor_reports v where v.object_path=o.name))>=100
  ) then raise exception 'Evidence allowance reached' using errcode='54000'; end if;
  insert into private.visitor_reports(report_id,tracking_hash,source_hash,payload_hash,contact,object_path)
    values(rid,tracking_hash,source_hash,payload_hash,contact,case when has_photo then rid::text||'/'||gen_random_uuid()::text||'.jpg' end);
  insert into private.visitor_write_context values(rid,pg_catalog.txid_current());
  insert into public.reports(id,title,description,category_slug,municipality,barangay,priority,latitude,longitude,incident_at,needed_by)
    values(rid,trim(payload->>'title'),trim(payload->>'description'),payload->>'category',payload->>'municipality',nullif(trim(payload->>'barangay'),''),(payload->>'priority')::public.report_priority,lat,lng,nullif(payload->>'incidentAt','')::timestamptz,nullif(payload->>'neededBy','')::date);
  if lat is not null then insert into public.report_private_locations(report_id,latitude,longitude) values(rid,lat,lng); end if;
  delete from private.visitor_write_context where report_id=rid;
  return jsonb_build_object('id',rid,'objectPath',(select object_path from private.visitor_reports where report_id=rid),'replayed',false);
end $$;

create function public.finalize_visitor_photo(target_report_id uuid, tracking_hash text) returns void
language plpgsql security definer set search_path='' as $$
declare target_path text; stored jsonb;
begin
  select v.object_path into target_path from private.visitor_reports v where v.report_id=target_report_id and v.tracking_hash=finalize_visitor_photo.tracking_hash for update;
  if target_path is null then raise exception 'Invalid receipt' using errcode='42501'; end if;
  if exists(select 1 from public.report_evidence where object_path=target_path) then return; end if;
  select metadata into stored from storage.objects where bucket_id='report-evidence' and name=target_path;
  if stored is null or stored->>'mimetype' is distinct from 'image/jpeg' or coalesce((stored->>'size')::integer,0) not between 1 and 2097152 then raise exception 'Invalid stored photo' using errcode='22023'; end if;
  insert into private.visitor_write_context values(target_report_id,pg_catalog.txid_current());
  insert into public.report_evidence(report_id,object_path,content_type,byte_size) values(target_report_id,target_path,'image/jpeg',(stored->>'size')::integer);
  delete from private.visitor_write_context where report_id=target_report_id;
end $$;

create function public.track_visitor_report(tracking_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',r.id,'status',r.status,'priority',r.priority,'created_at',r.created_at,'updated_at',r.updated_at,'decision_note',r.decision_note,
    'events',coalesce((select jsonb_agg(jsonb_build_object('status',e.status,'created_at',e.created_at) order by e.created_at,e.id) from public.report_events e where e.report_id=r.id),'[]'::jsonb))
  from private.visitor_reports v join public.reports r on r.id=v.report_id where v.tracking_hash=track_visitor_report.tracking_hash;
$$;

create function public.visitor_report_contact(target_report_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Moderator authorization required' using errcode='42501'; end if;
  return (select contact from private.visitor_reports where report_id=target_report_id);
end $$;

revoke all on function public.claim_visitor_attempt(text,text),public.submit_visitor_report(jsonb,text,text,text,boolean),public.finalize_visitor_photo(uuid,text),public.track_visitor_report(text),public.visitor_report_contact(uuid) from public,anon,authenticated,service_role;
grant execute on function public.claim_visitor_attempt(text,text),public.submit_visitor_report(jsonb,text,text,text,boolean),public.finalize_visitor_photo(uuid,text),public.track_visitor_report(text) to service_role;
grant execute on function public.visitor_report_contact(uuid) to authenticated;
alter function public.claim_visitor_attempt(text,text) owner to postgres;
alter function public.submit_visitor_report(jsonb,text,text,text,boolean) owner to postgres;
alter function public.finalize_visitor_photo(uuid,text) owner to postgres;
alter function public.track_visitor_report(text) owner to postgres;
alter function public.visitor_report_contact(uuid) owner to postgres;
notify pgrst,'reload schema';
commit;
