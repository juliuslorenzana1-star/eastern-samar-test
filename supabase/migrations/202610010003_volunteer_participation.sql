alter table public.volunteer_opportunities
  add column category text,
  add column barangay text,
  add column location text,
  add column latitude double precision,
  add column longitude double precision,
  add column skills text[] not null default '{}',
  add column tasks text[] not null default '{}',
  add column what_to_bring text[] not null default '{}',
  add column registration_open boolean not null default true,
  add column organizer_id uuid references public.profiles (id) on delete set null,
  add column organizer_name text,
  add column updated_at timestamptz not null default now();

alter table public.volunteer_opportunities
  drop constraint if exists volunteer_opportunities_status_check;
alter table public.volunteer_opportunities
  add constraint volunteer_opportunities_status_check
  check (status in ('draft', 'published', 'active', 'open', 'full', 'ongoing', 'completed', 'cancelled'));

update public.volunteer_opportunities o
set barangay = r.barangay,
    category = r.category_slug,
    latitude = r.latitude,
    longitude = r.longitude,
    organizer_id = o.created_by,
    updated_at = o.created_at
from public.reports r
where r.id = o.report_id;

update public.volunteer_opportunities o
set organizer_id = o.created_by,
    updated_at = o.created_at
where o.organizer_id is null;

update public.volunteer_opportunities o
set organizer_name = coalesce(p.display_name, 'Community Action Map staff')
from public.profiles p
where p.id = o.organizer_id;

alter table public.volunteer_opportunities
  add constraint volunteer_opportunities_coordinates_check
  check (
    (latitude is null and longitude is null)
    or (latitude between 10.53 and 12.51 and longitude between 124.95 and 126.13)
  );

create table public.volunteer_registrations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.volunteer_opportunities (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('registered', 'attended', 'completed', 'cancelled', 'no_show')) default 'registered',
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  volunteer_hours numeric(7, 2) check (volunteer_hours is null or volunteer_hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, volunteer_id)
);

insert into public.volunteer_registrations (opportunity_id, volunteer_id, joined_at)
select opportunity_id, user_id, created_at
from public.volunteer_signups
on conflict (opportunity_id, volunteer_id) do nothing;

create index volunteer_opportunities_location_idx
  on public.volunteer_opportunities (municipality, barangay);
create index volunteer_opportunities_schedule_idx
  on public.volunteer_opportunities (starts_at)
  where status in ('published', 'active', 'open', 'ongoing');
create index volunteer_registrations_volunteer_idx
  on public.volunteer_registrations (volunteer_id, joined_at desc);
create index volunteer_registrations_opportunity_status_idx
  on public.volunteer_registrations (opportunity_id, status);

alter table public.volunteer_registrations enable row level security;

drop policy volunteer_signup_self_manage on public.volunteer_signups;
create policy volunteer_signups_legacy_read on public.volunteer_signups
for select to authenticated using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.volunteer_signups from anon, authenticated;
grant select on public.volunteer_signups to authenticated;

create policy volunteer_registrations_self_or_staff_read on public.volunteer_registrations
for select to authenticated using (volunteer_id = auth.uid() or public.is_staff());
create policy volunteer_registrations_self_cancel on public.volunteer_registrations
for update to authenticated
using (
  volunteer_id = auth.uid()
  and status = 'registered'
  and exists (
    select 1 from public.volunteer_opportunities o
    where o.id = public.volunteer_registrations.opportunity_id
      and o.status in ('published', 'active', 'open')
      and (o.starts_at is null or o.starts_at > now())
  )
)
with check (volunteer_id = auth.uid() and status = 'cancelled');
create policy volunteer_registrations_staff_manage on public.volunteer_registrations
for all to authenticated using (public.is_staff()) with check (public.is_staff());

revoke all on public.volunteer_registrations from anon, authenticated;
grant select on public.volunteer_registrations to authenticated;
grant update (status) on public.volunteer_registrations to authenticated;

create or replace function public.set_volunteer_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger volunteer_opportunities_updated_at
before update on public.volunteer_opportunities
for each row execute function public.set_volunteer_updated_at();

create trigger volunteer_registrations_updated_at
before update on public.volunteer_registrations
for each row execute function public.set_volunteer_updated_at();

create or replace function public.set_volunteer_organizer_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.organizer_id is distinct from auth.uid() or not public.is_staff() then
      raise exception 'Only authorized staff can publish an opportunity for themselves.';
    end if;
    select coalesce(display_name, 'Community Action Map staff')
      into new.organizer_name
      from public.profiles
      where id = new.organizer_id;
  elsif new.organizer_id is distinct from old.organizer_id then
    if new.organizer_id is distinct from auth.uid() or not public.is_staff() then
      raise exception 'Only authorized staff can publish an opportunity for themselves.';
    end if;
    select coalesce(display_name, 'Community Action Map staff')
      into new.organizer_name
      from public.profiles
      where id = new.organizer_id;
  end if;
  return new;
end;
$$;

create trigger volunteer_opportunities_organizer_name
before insert or update of organizer_id on public.volunteer_opportunities
for each row execute function public.set_volunteer_organizer_name();

create or replace function public.join_volunteer_opportunity(p_opportunity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity public.volunteer_opportunities%rowtype;
  existing_registration public.volunteer_registrations%rowtype;
  active_count integer;
  registration_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to join this activity.' using errcode = '42501';
  end if;

  select * into opportunity
  from public.volunteer_opportunities
  where id = p_opportunity_id
  for update;

  if not found then
    raise exception 'This opportunity is no longer available.' using errcode = 'P0002';
  end if;
  if opportunity.status not in ('published', 'active', 'open') or not opportunity.registration_open then
    raise exception 'This activity is not accepting volunteers.' using errcode = 'P0001';
  end if;
  if opportunity.starts_at is not null and opportunity.starts_at <= now() then
    raise exception 'Registration is closed because this activity has started.' using errcode = 'P0001';
  end if;
  if opportunity.report_id is not null and not exists (
    select 1 from public.reports r
    where r.id = opportunity.report_id
      and r.is_public
      and r.status in ('approved', 'verified', 'in_progress', 'resolved')
  ) then
    raise exception 'This linked community report is no longer public.' using errcode = 'P0001';
  end if;

  select * into existing_registration
  from public.volunteer_registrations
  where volunteer_registrations.opportunity_id = p_opportunity_id
    and volunteer_id = current_user_id
  for update;

  if found and existing_registration.status <> 'cancelled' then
    raise exception 'You already have a registration for this activity.' using errcode = '23505';
  end if;

  select count(*) into active_count
  from public.volunteer_registrations
  where volunteer_registrations.opportunity_id = p_opportunity_id
    and status in ('registered', 'attended', 'completed');
  if opportunity.capacity is not null and active_count >= opportunity.capacity then
    raise exception 'This activity has reached its volunteer capacity.' using errcode = 'P0001';
  end if;

  if existing_registration.id is not null then
    update public.volunteer_registrations
    set status = 'registered', joined_at = now(), completed_at = null, volunteer_hours = null
    where id = existing_registration.id;
    return existing_registration.id;
  end if;

  insert into public.volunteer_registrations (opportunity_id, volunteer_id)
  values (opportunity.id, current_user_id)
  returning id into registration_id;
  return registration_id;
end;
$$;

create or replace function public.get_volunteer_signup_counts(p_opportunity_ids uuid[])
returns table (opportunity_id uuid, signup_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, count(r.id)::bigint
  from public.volunteer_opportunities o
  left join public.volunteer_registrations r
    on r.opportunity_id = o.id
    and r.status in ('registered', 'attended', 'completed')
  where o.id = any(p_opportunity_ids)
    and o.status in ('published', 'active', 'open', 'full', 'ongoing', 'completed', 'cancelled')
    and (
      o.report_id is null
      or exists (
        select 1 from public.reports report
        where report.id = o.report_id
          and report.is_public
          and report.status in ('approved', 'verified', 'in_progress', 'resolved')
      )
    )
  group by o.id;
$$;

create or replace function public.get_volunteer_community_totals()
returns table (volunteers_joined bigint, community_hours numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(distinct r.volunteer_id) filter (where r.status in ('registered', 'attended', 'completed')),
    coalesce(sum(r.volunteer_hours) filter (where r.status in ('attended', 'completed')), 0)::numeric
  from public.volunteer_registrations r
  join public.volunteer_opportunities o on o.id = r.opportunity_id
  where o.status in ('published', 'active', 'open', 'full', 'ongoing', 'completed')
    and (
      o.report_id is null
      or exists (
        select 1 from public.reports report
        where report.id = o.report_id
          and report.is_public
          and report.status in ('approved', 'verified', 'in_progress', 'resolved')
      )
    );
$$;

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
begin
  if not public.is_staff() then
    raise exception 'Only authorized staff can record attendance.' using errcode = '42501';
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
  if not found then
    raise exception 'Volunteer registration not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.join_volunteer_opportunity(uuid) from public, anon;
grant execute on function public.join_volunteer_opportunity(uuid) to authenticated;
revoke all on function public.get_volunteer_signup_counts(uuid[]) from public;
grant execute on function public.get_volunteer_signup_counts(uuid[]) to anon, authenticated;
revoke all on function public.get_volunteer_community_totals() from public;
grant execute on function public.get_volunteer_community_totals() to anon, authenticated;
revoke all on function public.record_volunteer_attendance(uuid, text, numeric) from public, anon;
grant execute on function public.record_volunteer_attendance(uuid, text, numeric) to authenticated;

drop policy opportunities_public_read on public.volunteer_opportunities;
create policy opportunities_public_read on public.volunteer_opportunities
for select to anon, authenticated
using (
  public.is_staff()
  or (
    status in ('published', 'active', 'open', 'full', 'ongoing', 'completed', 'cancelled')
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

grant select (
  category, barangay, location, latitude, longitude, skills, tasks, what_to_bring,
  registration_open, organizer_id, organizer_name, updated_at
) on public.volunteer_opportunities to anon, authenticated;
grant insert (
  category, barangay, location, latitude, longitude, skills, tasks, what_to_bring, organizer_id
) on public.volunteer_opportunities to authenticated;
grant update (
  category, barangay, location, latitude, longitude, skills, tasks, what_to_bring,
  registration_open
) on public.volunteer_opportunities to authenticated;

notify pgrst, 'reload schema';