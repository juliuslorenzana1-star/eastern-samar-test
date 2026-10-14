alter table public.profiles
  add column if not exists show_on_leaderboard boolean not null default false;

create or replace function public.get_public_leaderboard()
returns table (
  rank bigint,
  display_name text,
  community_hours numeric,
  volunteer_activities bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      p.id,
      p.display_name,
      coalesce(sum(r.volunteer_hours) filter (
        where r.status in ('attended', 'completed')
      ), 0)::numeric as community_hours,
      count(distinct r.opportunity_id) filter (
        where r.status in ('attended', 'completed')
      ) as volunteer_activities
    from public.profiles p
    left join public.volunteer_registrations r on r.volunteer_id = p.id
    where p.show_on_leaderboard = true
      and nullif(trim(p.display_name), '') is not null
    group by p.id, p.display_name
    having coalesce(sum(r.volunteer_hours) filter (
      where r.status in ('attended', 'completed')
    ), 0) > 0
  )
  select
    row_number() over (
      order by community_hours desc, volunteer_activities desc, display_name asc
    )::bigint as rank,
    display_name,
    community_hours,
    volunteer_activities
  from ranked;
$$;

revoke all on function public.get_public_leaderboard() from public, anon;
grant execute on function public.get_public_leaderboard() to anon, authenticated;

grant update (display_name, role, show_on_leaderboard) on public.profiles to authenticated;

create policy profiles_update_self_visibility on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());
