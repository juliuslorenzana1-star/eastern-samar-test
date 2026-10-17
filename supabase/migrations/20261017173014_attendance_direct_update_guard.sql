-- Approved and applied to eastern-samar-test on 2026-10-18 (Philippine time).
-- Deployed policy currently allows staff to directly update their own status.
-- This closes that path while preserving existing read and self-cancel policies.
begin;
alter policy volunteer_registrations_staff_manage
on public.volunteer_registrations
using (public.is_staff() and volunteer_id <> auth.uid())
with check (public.is_staff() and volunteer_id <> auth.uid());
commit;
