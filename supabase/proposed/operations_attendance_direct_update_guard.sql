-- PROPOSAL ONLY: requires user approval before applying this RLS policy change.
-- Deployed policy currently allows staff to directly update their own status.
-- This closes that path while preserving existing read and self-cancel policies.
begin;
alter policy volunteer_registrations_staff_manage
on public.volunteer_registrations
using (public.is_staff() and volunteer_id <> auth.uid())
with check (public.is_staff() and volunteer_id <> auth.uid());
commit;
