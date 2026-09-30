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
