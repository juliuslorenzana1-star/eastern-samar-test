alter table public.volunteer_opportunities
  add column report_id uuid references public.reports (id) on delete set null;

create index volunteer_opportunities_report_idx
  on public.volunteer_opportunities (report_id)
  where report_id is not null;

grant select (report_id) on public.volunteer_opportunities to anon, authenticated;
grant insert (report_id) on public.volunteer_opportunities to authenticated;

drop policy opportunities_public_read on public.volunteer_opportunities;
create policy opportunities_public_read on public.volunteer_opportunities
for select to anon, authenticated
using (
  public.is_staff()
  or (
    status in ('published', 'active', 'completed')
    and (
      report_id is null
      or exists (
        select 1 from public.reports r
        where r.id = volunteer_opportunities.report_id
          and r.is_public
          and r.status in ('approved', 'verified', 'in_progress', 'resolved')
      )
    )
  )
);

drop policy opportunities_staff_manage on public.volunteer_opportunities;
create policy opportunities_staff_manage on public.volunteer_opportunities
for all to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and (
    report_id is null
    or exists (
      select 1 from public.reports r
      where r.id = volunteer_opportunities.report_id
        and r.is_public
        and r.status in ('approved', 'verified', 'in_progress', 'resolved')
    )
  )
);

notify pgrst, 'reload schema';