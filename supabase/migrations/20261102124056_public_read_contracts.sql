-- Narrow public timeline/statistics repair; no historical migration replay.
-- Privileged read review: FINAL_READINESS_REVIEW.md. Production application requires approval.
begin;
create or replace function public.report_progress(target_report_id uuid)
returns table(id uuid,status public.report_status,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
  select e.id,e.status,e.created_at
  from public.report_events e join public.reports r on r.id=e.report_id
  where r.id=target_report_id and (
    (auth.uid() is not null and (r.reporter_id=auth.uid() or public.is_staff()))
    or (r.is_public and r.status in ('approved','verified','in_progress','resolved')
      and e.status in ('approved','verified','in_progress','resolved')))
  order by e.created_at,e.id;
$$;
alter function public.report_progress(uuid) owner to postgres;
revoke all on function public.report_progress(uuid) from public,anon,authenticated,service_role;
grant execute on function public.report_progress(uuid) to anon,authenticated;

create or replace function public.platform_statistics()
returns table(total_reports bigint,pending_reports bigint,verified_reports bigint,resolved_reports bigint,
  active_volunteers bigint,completed_activities bigint,verified_hours numeric,municipalities_reached bigint)
language sql stable security definer set search_path=''
as $$
  with visible_reports as (
    select * from public.reports where public.is_staff()
      or (is_public and status in ('approved','verified','in_progress','resolved'))
  ), visible_activities as (
    select * from public.volunteer_opportunities o
    where o.status in ('published','active','open','full','ongoing','completed','cancelled')
      and (o.report_id is null or exists(select 1 from public.reports r
        where r.id=o.report_id and r.is_public and r.status in ('approved','verified','in_progress','resolved')))
  )
  select (select count(*) from visible_reports),
    case when public.is_staff() then (select count(*) from visible_reports
      where status in ('pending_review','under_review','needs_more_information')) else null end,
    -- Same semantics as sync_report_lifecycle in the canonical migration:
    -- approval/progress/resolution alone is not evidence of verification.
    (select count(*) from visible_reports where status='verified'
      or (status in ('in_progress','resolved') and verified_at is not null)),
    (select count(*) from visible_reports where status='resolved'),
    (select count(distinct r.volunteer_id) from public.volunteer_registrations r
      join visible_activities o on o.id=r.opportunity_id where r.status='registered' and o.status not in ('completed','cancelled')),
    (select count(*) from visible_activities where status='completed'),
    (select coalesce(sum(r.volunteer_hours),0)::numeric from public.volunteer_registrations r
      join visible_activities o on o.id=r.opportunity_id where r.status in ('attended','completed')),
    (select count(distinct municipality) from visible_reports);
$$;
alter function public.platform_statistics() owner to postgres;
revoke all on function public.platform_statistics() from public,anon,authenticated,service_role;
grant execute on function public.platform_statistics() to anon,authenticated;
notify pgrst,'reload schema';
commit;
