-- REVIEW ONLY. Not in migrations; do not apply without owner approval.
begin;
alter table public.profiles add column if not exists public_alias text
  check (public_alias is null or char_length(trim(public_alias)) between 1 and 80);
grant update (public_alias) on public.profiles to authenticated;

-- A separate alias avoids publishing the account's profile name.
create or replace function public.get_public_leaderboard()
returns table (rank bigint, display_name text, community_hours numeric, volunteer_activities bigint)
language sql stable security definer set search_path = public as $$
  with contributions as (
    select p.id, p.public_alias as display_name,
      coalesce(sum(r.volunteer_hours) filter (where r.status in ('attended', 'completed')), 0)::numeric as community_hours,
      count(distinct r.opportunity_id) filter (where r.status = 'completed') as volunteer_activities
    from public.profiles p join public.volunteer_registrations r on r.volunteer_id = p.id
    where p.show_on_leaderboard and nullif(trim(p.public_alias), '') is not null
    group by p.id, p.public_alias
    having coalesce(sum(r.volunteer_hours) filter (where r.status in ('attended', 'completed')), 0) > 0
  )
  select dense_rank() over (order by community_hours desc), display_name, community_hours, volunteer_activities
  from contributions order by community_hours desc, display_name asc;
$$;

-- Existing attendance RPC remains intact. This trigger adds a database guard
-- regardless of whether attendance is changed by RPC or direct update.
create function public.guard_volunteer_credit()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.volunteer_hours is distinct from old.volunteer_hours
     or new.status is distinct from old.status then
    if new.volunteer_id = auth.uid() and
       (new.volunteer_hours is distinct from old.volunteer_hours or new.status in ('attended', 'completed')) then
      raise exception 'You cannot verify your own volunteer contribution.' using errcode = '42501';
    end if;
    if (new.volunteer_hours is distinct from old.volunteer_hours or new.status in ('attended', 'completed'))
       and not public.is_staff() then
      raise exception 'Only authorized staff can verify contributions.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger volunteer_credit_guard before update on public.volunteer_registrations
for each row execute function public.guard_volunteer_credit();

create table public.email_notification_log (
  notification_type text not null check (notification_type in ('report_submission', 'volunteer_registration')),
  reference_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved', 'accepted', 'failed', 'uncertain')),
  provider_id text,
  created_at timestamptz not null default now(),
  primary key (notification_type, reference_id)
);
create index email_notification_user_time on public.email_notification_log(user_id, created_at);
alter table public.email_notification_log enable row level security;
revoke all on public.email_notification_log from anon, authenticated;
grant select, insert, update on public.email_notification_log to service_role;

create function public.claim_email_notification(p_user_id uuid, p_type text, p_reference uuid)
returns text language plpgsql security definer set search_path = public as $$
declare existing_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select status into existing_status from public.email_notification_log
    where notification_type = p_type and reference_id = p_reference;
  if found then return existing_status; end if;
  if (select count(*) from public.email_notification_log
      where user_id = p_user_id and created_at > now() - interval '1 hour') >= 10 then
    return 'rate_limited';
  end if;
  insert into public.email_notification_log(notification_type, reference_id, user_id)
    values (p_type, p_reference, p_user_id);
  return 'claimed';
end;
$$;
revoke all on function public.claim_email_notification(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_email_notification(uuid, text, uuid) to service_role;
commit;
