-- REVIEW ONLY: not applied to production. Requires separate release approval.
-- Close Supabase Auth signup in the dashboard as a separate provider control.
-- This trigger guard covers direct API calls AND owner-privileged write RPCs;
-- restrictive RLS alone does not cover SECURITY DEFINER routines.
-- No existing records/policies/grants are changed. Do not apply to staging.
begin;
create schema if not exists private;
create or replace function private.enforce_privacy_release_pause()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if tg_table_schema='storage' then
    if new.bucket_id<>'report-evidence' then return new; end if;
  elsif tg_table_name='profiles' and tg_op='UPDATE' then
    -- Preserve existing role administration while pausing new personal details.
    if (pg_catalog.to_jsonb(new)->'display_name') is not distinct from (pg_catalog.to_jsonb(old)->'display_name')
      and (pg_catalog.to_jsonb(new)->'public_alias') is not distinct from (pg_catalog.to_jsonb(old)->'public_alias')
      and (pg_catalog.to_jsonb(new)->'show_on_leaderboard') is not distinct from (pg_catalog.to_jsonb(old)->'show_on_leaderboard') then
      return new;
    end if;
  end if;
  raise exception 'Public collection is paused pending privacy approval.' using errcode='42501';
end;
$$;
revoke all on function private.enforce_privacy_release_pause() from public,anon,authenticated,service_role;
do $$ declare target text; begin
  foreach target in array array['reports','report_evidence','report_private_locations','profiles','volunteer_registrations','volunteer_signups'] loop
    if pg_catalog.to_regclass('public.'||target) is not null then
      execute pg_catalog.format('drop trigger if exists aaa_privacy_release_pause_insert on public.%I',target);
      execute pg_catalog.format('create trigger aaa_privacy_release_pause_insert before insert on public.%I for each row execute function private.enforce_privacy_release_pause()',target);
    end if;
  end loop;
end $$;
drop trigger if exists aaa_privacy_release_pause_profile_update on public.profiles;
create trigger aaa_privacy_release_pause_profile_update before update on public.profiles
  for each row execute function private.enforce_privacy_release_pause();
drop trigger if exists aaa_privacy_release_pause_storage on storage.objects;
create trigger aaa_privacy_release_pause_storage before insert or update on storage.objects
  for each row execute function private.enforce_privacy_release_pause();
commit;
-- To resume after approved privacy readiness, review and remove ONLY these named
-- pause triggers and this function. Existing RLS, ownership and quotas must stay.
-- This SQL does not configure Auth, publish notices, approve retention or provide
-- a rights-request contact. It is not evidence that production collection is off.
