-- Local/dev helper: run AFTER 202609300001_review_decision_visibility.sql.
-- Safe to re-run. Nothing here publishes a report or grants public write access.

-- 1) The three new review columns exist.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'reports'
   and column_name in ('reviewed_by', 'reviewed_at', 'decision_note')
 order by column_name;

-- 2) Only the five-argument moderate_report survives (no ambiguous overload).
select p.oid::regprocedure as signature,
       pg_get_function_identity_arguments(p.oid) as arguments
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'moderate_report';

-- 3) Client roles hold no write path to review state. Expect no rows for
--    anon/authenticated with priv_type UPDATE or DELETE.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'reports'
   and grantee in ('anon', 'authenticated')
 order by grantee, privilege_type;

-- 4) Promote your own account so the Review queue appears. Replace the email,
--    then sign out and sign back in (is_staff() reads the profile per request).
-- update public.profiles p
--    set role = 'admin'
--   from auth.users u
--  where p.id = u.id
--    and u.email = 'your-signup-email@example.com';

-- 5) Current review state of recent reports, including what is publicly visible.
select title, status, is_public, priority, decision_note, reviewed_at, created_at
  from public.reports
 order by created_at desc
 limit 20;
