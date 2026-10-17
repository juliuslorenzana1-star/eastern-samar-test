-- Approved and applied to eastern-samar-test on 2026-10-18 (Philippine time).
-- Version matches Supabase migration history. Requires the accompanying direct-update policy guard.
begin;
create or replace function public.record_volunteer_attendance(
  p_registration_id uuid,
  p_status text,
  p_volunteer_hours numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_volunteer uuid;
begin
  if not public.is_staff() then
    raise exception 'Only authorized staff can record attendance.' using errcode = '42501';
  end if;
  select volunteer_id into target_volunteer
  from public.volunteer_registrations
  where id = p_registration_id
  for update;
  if not found then
    raise exception 'Volunteer registration not found.' using errcode = 'P0002';
  end if;
  if target_volunteer = auth.uid() then
    raise exception 'Staff cannot approve or modify their own attendance or service hours.' using errcode = '42501';
  end if;
  if p_status not in ('registered', 'attended', 'completed', 'cancelled', 'no_show') then
    raise exception 'Invalid volunteer registration status.' using errcode = '22023';
  end if;
  if p_volunteer_hours is not null and p_volunteer_hours < 0 then
    raise exception 'Volunteer hours cannot be negative.' using errcode = '22023';
  end if;
  update public.volunteer_registrations
  set status = p_status,
      completed_at = case when p_status = 'completed' then now() else null end,
      volunteer_hours = p_volunteer_hours
  where id = p_registration_id;
end;
$$;
revoke all on function public.record_volunteer_attendance(uuid, text, numeric) from public, anon;
grant execute on function public.record_volunteer_attendance(uuid, text, numeric) to authenticated;
commit;
