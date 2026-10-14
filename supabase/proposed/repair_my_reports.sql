-- Targeted repair; requires approval before application. No policies/data change.
-- Supports databases without the optional review-decision columns.
begin;
create or replace function public.my_reports()
returns table (
  id uuid, title text, description text, category_slug text, municipality text,
  barangay text, latitude double precision, longitude double precision,
  incident_at timestamptz, needed_by date, priority public.report_priority,
  status public.report_status, is_public boolean, created_at timestamptz,
  updated_at timestamptz, verified_at timestamptz, resolved_at timestamptz,
  decision_note text, reviewed_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, r.title, r.description, r.category_slug, r.municipality,
    r.barangay, r.latitude, r.longitude, r.incident_at, r.needed_by, r.priority,
    r.status, r.is_public, r.created_at, r.updated_at, r.verified_at,
    r.resolved_at, to_jsonb(r)->>'decision_note',
    (to_jsonb(r)->>'reviewed_at')::timestamptz
  from public.reports r
  where auth.uid() is not null and r.reporter_id = auth.uid()
  order by r.created_at desc limit 100;
$$;
revoke all on function public.my_reports() from public, anon;
grant execute on function public.my_reports() to authenticated;
notify pgrst, 'reload schema';
commit;
