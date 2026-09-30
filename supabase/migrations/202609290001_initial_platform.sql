create type public.app_role as enum ('resident', 'moderator', 'admin');
create type public.report_status as enum (
  'pending_review',
  'under_review',
  'needs_more_information',
  'approved',
  'verified',
  'in_progress',
  'resolved',
  'rejected'
);
create type public.report_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  role public.app_role not null default 'resident',
  created_at timestamptz not null default now()
);

create table public.report_categories (
  slug text primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order smallint not null default 0
);

insert into public.report_categories (slug, name, sort_order) values
  ('disaster-emergency', 'Disaster / Emergency', 1),
  ('infrastructure', 'Infrastructure', 2),
  ('environment', 'Environment', 3),
  ('public-safety', 'Public Safety', 4),
  ('health', 'Health', 5),
  ('education', 'Education', 6),
  ('transportation', 'Transportation', 7),
  ('community-services', 'Community Services', 8),
  ('youth', 'Youth', 9),
  ('other', 'Other', 10)
on conflict (slug) do nothing;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(title) between 6 and 120),
  description text not null check (char_length(description) between 12 and 4000),
  category_slug text not null references public.report_categories (slug),
  municipality text not null check (char_length(municipality) between 1 and 80),
  barangay text check (barangay is null or char_length(barangay) <= 100),
  latitude double precision,
  longitude double precision,
  incident_at timestamptz,
  needed_by date,
  priority public.report_priority not null default 'normal',
  status public.report_status not null default 'pending_review',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  resolved_at timestamptz,
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create table public.report_private_locations (
  report_id uuid primary key references public.reports (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  status public.report_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.moderator_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  moderator_id uuid not null references public.profiles (id) on delete restrict,
  note text not null check (char_length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  object_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  created_at timestamptz not null default now()
);

create table public.ai_review_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  flag_type text not null check (flag_type in ('spam', 'abuse', 'duplicate', 'irrelevant', 'other')),
  confidence numeric(4, 3) check (confidence between 0 and 1),
  explanation text,
  model_name text,
  created_at timestamptz not null default now()
);

create table public.possible_report_matches (
  report_id uuid not null references public.reports (id) on delete cascade,
  possible_match_id uuid not null references public.reports (id) on delete cascade,
  similarity numeric(4, 3) check (similarity between 0 and 1),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  primary key (report_id, possible_match_id),
  check (report_id <> possible_match_id)
);

create table public.community_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 160),
  description text not null check (char_length(description) between 12 and 4000),
  municipality text,
  status text not null check (status in ('draft', 'published', 'active', 'completed', 'cancelled')) default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.volunteer_opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.community_projects (id) on delete set null,
  title text not null check (char_length(title) between 4 and 160),
  description text not null check (char_length(description) between 12 and 4000),
  municipality text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  status text not null check (status in ('draft', 'published', 'active', 'completed', 'cancelled')) default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.volunteer_signups (
  opportunity_id uuid not null references public.volunteer_opportunities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, user_id)
);

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid references public.reports (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_reporter_created_idx on public.reports (reporter_id, created_at desc);
create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_area_category_idx on public.reports (municipality, category_slug);
create index report_events_report_created_idx on public.report_events (report_id, created_at desc);
create index notifications_user_created_idx on public.user_notifications (user_id, created_at desc);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile_created
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can change account roles';
  end if;
  return new;
end;
$$;

create trigger profiles_role_guard
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.set_report_defaults_and_location_precision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to submit a report';
  end if;
  new.reporter_id := auth.uid();
  new.status := 'pending_review';
  new.is_public := false;
  new.verified_at := null;
  new.resolved_at := null;
  if new.latitude is not null then
    new.latitude := round(new.latitude::numeric, 2)::double precision;
    new.longitude := round(new.longitude::numeric, 2)::double precision;
  end if;
  return new;
end;
$$;

create trigger reports_submission_guard
before insert on public.reports
for each row execute function public.set_report_defaults_and_location_precision();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reports_touch_updated_at
before update on public.reports
for each row execute function public.touch_updated_at();

create trigger projects_touch_updated_at
before update on public.community_projects
for each row execute function public.touch_updated_at();

create or replace function public.record_report_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.report_events (report_id, actor_id, status)
    values (new.id, new.reporter_id, new.status);
  elsif new.status is distinct from old.status then
    insert into public.report_events (report_id, actor_id, status)
    values (new.id, auth.uid(), new.status);
  end if;
  return new;
end;
$$;

create trigger reports_status_event
 after insert or update of status on public.reports
 for each row execute function public.record_report_status_event();

create or replace function public.moderate_report(
  target_report_id uuid,
  next_status public.report_status,
  next_priority public.report_priority,
  internal_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Moderator access is required';
  end if;
  if next_status = 'verified' and not public.is_staff() then
    raise exception 'Verification requires an authorized moderator';
  end if;
  update public.reports
  set status = next_status,
      priority = next_priority,
      is_public = next_status in ('approved', 'verified', 'in_progress', 'resolved'),
      verified_at = case when next_status = 'verified' then now() else verified_at end,
      resolved_at = case when next_status = 'resolved' then now() else null end
  where id = target_report_id;
  if not found then
    raise exception 'Report not found';
  end if;
  if nullif(trim(internal_note), '') is not null then
    insert into public.moderator_notes (report_id, moderator_id, note)
    values (target_report_id, auth.uid(), left(trim(internal_note), 4000));
  end if;
end;
$$;

revoke all on function public.moderate_report(uuid, public.report_status, public.report_priority, text) from public, anon;
grant execute on function public.moderate_report(uuid, public.report_status, public.report_priority, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.report_categories enable row level security;
alter table public.reports enable row level security;
alter table public.report_private_locations enable row level security;
alter table public.report_events enable row level security;
alter table public.moderator_notes enable row level security;
alter table public.report_evidence enable row level security;
alter table public.ai_review_flags enable row level security;
alter table public.possible_report_matches enable row level security;
alter table public.community_projects enable row level security;
alter table public.volunteer_opportunities enable row level security;
alter table public.volunteer_signups enable row level security;
alter table public.user_notifications enable row level security;

revoke all on table
  public.profiles,
  public.report_categories,
  public.reports,
  public.report_private_locations,
  public.report_events,
  public.moderator_notes,
  public.report_evidence,
  public.ai_review_flags,
  public.possible_report_matches,
  public.community_projects,
  public.volunteer_opportunities,
  public.volunteer_signups,
  public.user_notifications
from anon, authenticated;

create policy profiles_read_self_or_staff on public.profiles
for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

grant select on public.profiles to authenticated;
grant update (display_name, role) on public.profiles to authenticated;

grant select on public.report_categories to anon, authenticated;
grant insert, update, delete on public.report_categories to authenticated;
create policy categories_read_active on public.report_categories
for select to anon, authenticated using (active or public.is_staff());
create policy categories_admin_manage on public.report_categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select (id, title, description, category_slug, municipality, barangay, latitude, longitude, incident_at, needed_by, priority, status, is_public, created_at, updated_at, verified_at, resolved_at)
on public.reports to anon, authenticated;
grant insert (title, description, category_slug, municipality, barangay, latitude, longitude, incident_at, needed_by, priority)
on public.reports to authenticated;
create policy reports_read_owner_staff_or_public on public.reports
for select to anon, authenticated
using (
  reporter_id = auth.uid()
  or public.is_staff()
  or (is_public and status in ('approved', 'verified', 'in_progress', 'resolved'))
);
create policy reports_insert_own_pending on public.reports
for insert to authenticated
with check (reporter_id = auth.uid() and status = 'pending_review' and not is_public and verified_at is null);

create policy private_locations_owner_or_staff_read on public.report_private_locations
for select to authenticated using (
  public.is_staff() or exists (
    select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid()
  )
);
create policy private_locations_owner_insert on public.report_private_locations
for insert to authenticated with check (
  exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid())
);
grant select, insert on public.report_private_locations to authenticated;

create policy report_events_owner_or_staff_read on public.report_events
for select to authenticated using (
  public.is_staff() or exists (
    select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid()
  )
);
grant select on public.report_events to authenticated;
create policy moderator_notes_staff_read on public.moderator_notes
for select to authenticated using (public.is_staff());
grant select on public.moderator_notes to authenticated;

create policy evidence_owner_or_staff_read on public.report_evidence
for select to authenticated using (
  public.is_staff() or exists (
    select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid()
  )
);
create policy evidence_owner_insert on public.report_evidence
for insert to authenticated with check (
  uploaded_by = auth.uid() and exists (
    select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid()
  )
);
grant select, insert on public.report_evidence to authenticated;

create policy ai_flags_staff_only on public.ai_review_flags
for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy possible_matches_staff_only on public.possible_report_matches
for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, insert, update, delete on public.ai_review_flags, public.possible_report_matches to authenticated;

create policy projects_public_read on public.community_projects
for select to anon, authenticated using (status in ('published', 'active', 'completed') or public.is_staff());
create policy projects_staff_manage on public.community_projects
for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select (id, title, description, municipality, status, starts_at, ends_at, created_at, updated_at)
on public.community_projects to anon, authenticated;
grant insert (title, description, municipality, status, starts_at, ends_at),
  update (title, description, municipality, status, starts_at, ends_at), delete
on public.community_projects to authenticated;

create policy opportunities_public_read on public.volunteer_opportunities
for select to anon, authenticated using (status in ('published', 'active', 'completed') or public.is_staff());
create policy opportunities_staff_manage on public.volunteer_opportunities
for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select (id, project_id, title, description, municipality, starts_at, ends_at, capacity, status, created_at)
on public.volunteer_opportunities to anon, authenticated;
grant insert (project_id, title, description, municipality, starts_at, ends_at, capacity, status),
  update (project_id, title, description, municipality, starts_at, ends_at, capacity, status), delete
on public.volunteer_opportunities to authenticated;

create policy volunteer_signup_self_manage on public.volunteer_signups
for all to authenticated using (user_id = auth.uid() or public.is_staff())
with check (
  user_id = auth.uid() and exists (
    select 1 from public.volunteer_opportunities o
    where o.id = opportunity_id and o.status in ('published', 'active')
  )
);
grant select, insert, delete on public.volunteer_signups to authenticated;

create policy notifications_self_manage on public.user_notifications
for select to authenticated using (user_id = auth.uid());
create policy notifications_self_update on public.user_notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update (read_at) on public.user_notifications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy report_evidence_storage_read_owner_or_staff on storage.objects
for select to authenticated using (
  bucket_id = 'report-evidence' and exists (
    select 1 from public.reports r
    where r.id::text = (storage.foldername(name))[1]
      and (r.reporter_id = auth.uid() or public.is_staff())
  )
);
create policy report_evidence_storage_insert_owner on storage.objects
for insert to authenticated with check (
  bucket_id = 'report-evidence' and exists (
    select 1 from public.reports r
    where r.id::text = (storage.foldername(name))[1] and r.reporter_id = auth.uid()
  )
);
