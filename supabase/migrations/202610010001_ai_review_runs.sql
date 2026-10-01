create table public.ai_review_runs (
  report_id uuid primary key references public.reports (id) on delete cascade,
  status text not null check (status in ('pending', 'completed', 'unavailable', 'failed')),
  model_name text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_review_runs enable row level security;
revoke all on public.ai_review_runs from anon, authenticated;
grant select on public.ai_review_runs to authenticated;

create policy ai_review_runs_staff_read on public.ai_review_runs
for select to authenticated using (public.is_staff());