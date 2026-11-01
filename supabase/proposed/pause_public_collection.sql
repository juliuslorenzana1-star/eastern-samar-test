-- PROPOSED ONLY. NOT APPLIED. Rehearse and obtain explicit production approval.
-- Auth signup/recovery configuration is a separate provider control; this SQL
-- alone cannot stop collection by Supabase Auth or an already deployed frontend.
-- Preserve existing policies and data. Restrictive policies compose with them.
begin;
do $$
declare target text;
begin
  foreach target in array array['reports','report_evidence','report_private_locations','profiles','volunteer_registrations','volunteer_signups'] loop
    if to_regclass('public.' || target) is not null then
      execute format('create policy privacy_release_pause_insert on public.%I as restrictive for insert to anon, authenticated with check (false)', target);
      execute format('create policy privacy_release_pause_update on public.%I as restrictive for update to anon, authenticated using (false) with check (false)', target);
    end if;
  end loop;
end $$;
commit;
-- SECURITY DEFINER RPCs can bypass RLS: pause their browser EXECUTE grants too.
-- Run inside the same reviewed transaction in the approved operator version.
-- This draft deliberately does not guess live overloads. Inventory pg_proc and
-- current grants first, then revoke the exact public submission/join/profile
-- mutation entry points. Never claim this draft is a complete production pause.
