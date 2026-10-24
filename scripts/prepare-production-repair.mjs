// Prepare a reviewable SQL file only. This script never connects to a database.
import { readFile, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=(path)=>readFile(new URL(path,root),'utf8');
const review=await read('supabase/migrations/202609300001_review_decision_visibility.sql');
const completion=(await read('supabase/migrations/20261024172951_platform_completion.sql')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const sql=`-- REVIEW BEFORE APPLYING. Generated for the inspected eastern-samar-test schema.
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
${review}
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
${completion}
commit;
`;
await writeFile(new URL('supabase/proposed/production_readiness_repair.sql',root),sql);
console.log('Prepared supabase/proposed/production_readiness_repair.sql; no database connection made.');
