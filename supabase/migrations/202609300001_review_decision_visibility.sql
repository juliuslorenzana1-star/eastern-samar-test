-- Review-decision visibility for the resident who submitted a report.
--
-- Why this migration exists:
-- The submission guard (reports_submission_guard) already forces every new report
-- to status = 'pending_review' and is_public = false, and the reports_read policy
-- already hides anything that is not public. What was missing is the feedback loop:
-- the only place a decision reason could be written was public.moderator_notes,
-- which is staff-only by policy, so a resident could never learn that a report was
-- rejected, nor why. This adds a resident-facing reason plus the review audit
-- columns, and rewrites moderate_report() so the two kinds of note stay separate.
--
-- Nothing here changes how a report becomes public: is_public is still only ever
-- set by moderate_report(), which only public.is_staff() can execute.

alter table public.reports
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists decision_note text
    check (decision_note is null or char_length(decision_note) between 1 and 600);

comment on column public.reports.reviewed_by is 'Moderator account that last recorded a review decision. Never granted to anon.';
comment on column public.reports.reviewed_at is 'When the last review decision was recorded.';
comment on column public.reports.decision_note is 'Resident-facing reason for a rejection or a request for more information. Readable by the reporter and staff only through the reports_read policy; never granted to anon.';

-- Belt and braces: no client role may ever write review state directly.
-- Review state is only reachable through the moderate_report() RPC.
revoke update, delete, truncate on public.reports from anon, authenticated;


-- Replace the four-argument version with a five-argument version. Postgres keeps
-- overloads rather than replacing them, so the old signature is dropped first to
-- avoid an ambiguous call from PostgREST.
drop function if exists public.moderate_report(uuid, public.report_status, public.report_priority, text);

create or replace function public.moderate_report(
  target_report_id uuid,
  next_status public.report_status,
  next_priority public.report_priority,
  internal_note text default null,
  resident_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.reports;
  note_for_resident text;
  note_for_staff text;
begin
  -- Role comes from the server-side profile row, never from the request body.
  if not public.is_staff() then
    raise exception 'Moderator access is required' using errcode = '42501';
  end if;

  select * into target from public.reports where id = target_report_id;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  note_for_resident := nullif(trim(coalesce(resident_note, '')), '');
  note_for_staff := nullif(trim(coalesce(internal_note, '')), '');

  -- A resident must never see a bare "Rejected" with no explanation, and a
  -- report sent back for more information must say what is missing.
  if next_status in ('rejected', 'needs_more_information') and note_for_resident is null then
    raise exception 'Add a short reason for the reporter before rejecting or requesting more information.'
      using errcode = '22023';
  end if;

  -- A rejected report has to go back through review before it can be published
  -- again, so one careless click cannot move a rejected report onto the public map.
  if target.status = 'rejected'
    and next_status in ('approved', 'verified', 'in_progress', 'resolved')
    and not public.is_admin()
  then
    raise exception 'A rejected report must return to review before it can be published.'
      using errcode = '42501';
  end if;

  update public.reports
     set status = next_status,
         priority = next_priority,
         is_public = next_status in ('approved', 'verified', 'in_progress', 'resolved'),
         verified_at = case when next_status = 'verified' then now() else verified_at end,
         resolved_at = case when next_status = 'resolved' then now() else null end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         decision_note = left(note_for_resident, 600)
   where id = target_report_id;

  -- Keep the resident-facing reason on the status event that recorded this change.
  if target.status is distinct from next_status then
    update public.report_events
       set note = left(note_for_resident, 600)
     where id = (
       select event.id from public.report_events event
       where event.report_id = target_report_id
       order by event.created_at desc, event.id desc
       limit 1
     );
  end if;

  -- Internal notes stay in their own staff-only table and are never merged into
  -- decision_note, so nothing internal can leak to a resident through a read.
  if note_for_staff is not null then
    insert into public.moderator_notes (report_id, moderator_id, note)
    values (target_report_id, auth.uid(), left(note_for_staff, 4000));
  end if;
end;
$$;

revoke all on function public.moderate_report(uuid, public.report_status, public.report_priority, text, text)
  from public, anon;
grant execute on function public.moderate_report(uuid, public.report_status, public.report_priority, text, text)
  to authenticated;

-- decision_note and reviewed_at stay readable (RLS decides who); reviewed_by is
-- deliberately not granted so a moderator account id is never returned to a client.
grant select (decision_note, reviewed_at) on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Fix for "permission denied for table reports" for a signed-in resident
-- ---------------------------------------------------------------------------
-- The initial migration grants SELECT on public.reports column by column:
--   grant select (id, title, description, category_slug, municipality, barangay,
--     latitude, longitude, incident_at, needed_by, priority, status, is_public,
--     created_at, updated_at, verified_at, resolved_at) on public.reports to anon, authenticated;
-- reporter_id is NOT in that list. PostgreSQL enforces SELECT privileges on
-- columns used in WHERE too, so a client-side filter such as
--   GET /rest/v1/reports?reporter_id=eq.<uid>&select=...
-- is rejected with 42501 "permission denied for table reports" before RLS ever
-- runs. That is a privilege error, not a policy error, which is why no policy
-- change can fix it.
--
-- This function does the same job inside the database: it runs as the table owner
-- (so the missing column grant is irrelevant) and applies the auth.uid() filter
-- itself, so a client never has to name reporter_id. It returns exactly the
-- caller's own rows and nothing else.
create or replace function public.my_reports()
returns table (
  id uuid,
  title text,
  description text,
  category_slug text,
  municipality text,
  barangay text,
  latitude double precision,
  longitude double precision,
  incident_at timestamptz,
  needed_by date,
  priority public.report_priority,
  status public.report_status,
  is_public boolean,
  created_at timestamptz,
  updated_at timestamptz,
  verified_at timestamptz,
  resolved_at timestamptz,
  decision_note text,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.description, r.category_slug, r.municipality, r.barangay,
         r.latitude, r.longitude, r.incident_at, r.needed_by,
         r.priority, r.status, r.is_public,
         r.created_at, r.updated_at, r.verified_at, r.resolved_at,
         r.decision_note, r.reviewed_at
  from public.reports r
  where r.reporter_id = auth.uid()
  order by r.created_at desc
  limit 100;
$$;

comment on function public.my_reports() is 'Returns the signed-in caller''s own reports, including the resident-facing review reason. Filtered by auth.uid() and runs as the table owner so the column-level SELECT grant on reporter_id is not needed.';

revoke all on function public.my_reports() from public, anon;
grant execute on function public.my_reports() to authenticated;

-- Bridge for the bundle that is already deployed: that build still asks the
-- database for reporter_id, so it keeps failing with 42501 until this grant
-- exists. The exposure is limited: RLS (reports_read_owner_staff_or_public) still
-- decides which ROWS a caller can see, and this only reveals the reporter's UUID
-- for rows they may already read -- their own reports plus published ones. No
-- name, email, or phone is reachable through it. Once the build that calls
-- public.my_reports() is live, this grant can be withdrawn with:
--   revoke select (reporter_id) on public.reports from authenticated;
grant select (reporter_id) on public.reports to authenticated;

-- Make the running PostgREST instance pick up the new columns and the new
-- function at once. Without this, the API can keep answering "Could not find the
-- 'decision_note' column" (PGRST202/204) against its cached schema for a while
-- even though the SQL above has already committed.
notify pgrst, 'reload schema';
