-- Additive repair: existing attendance records and RLS policies are preserved.
alter table public.profiles add column if not exists show_on_leaderboard boolean not null default false;
alter table public.profiles add column if not exists public_alias text check (public_alias is null or length(btrim(public_alias)) between 1 and 80);
grant select (show_on_leaderboard, public_alias), update (show_on_leaderboard, public_alias) on public.profiles to authenticated;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace view private.recognition_totals with (security_invoker = true) as
select r.volunteer_id,
  coalesce(sum(case when r.volunteer_hours > 0 and r.volunteer_hours <> 'NaN'::numeric then r.volunteer_hours else 0 end),0) as hours,
  count(*) filter (where r.status = 'completed') as completed,
  count(*) filter (where r.status = 'completed' and o.category = 'environment') as environmental,
  count(distinct o.municipality) filter (where r.status = 'completed') as communities
from public.volunteer_registrations r join public.volunteer_opportunities o on o.id = r.opportunity_id
where r.status in ('attended','completed') group by r.volunteer_id;
revoke all on private.recognition_totals from public, anon, authenticated;

create or replace function private.recognition_badges(hours numeric, completed bigint, environmental bigint, communities bigint)
returns text[] language sql immutable set search_path = '' as $$
 select array_remove(array[
 case when completed >= 1 then 'first-community-action' end,
 case when completed >= 3 then 'active-volunteer' end,
 case when environmental >= 3 then 'environmental-champion' end,
 case when completed >= 5 and communities >= 2 then 'community-builder' end,
 case when hours >= 40 and completed >= 5 then 'dedicated-volunteer' end], null);
$$;
revoke all on function private.recognition_badges(numeric,bigint,bigint,bigint) from public, anon, authenticated;

create or replace function public.get_community_recognition()
returns table(rank bigint, public_alias text, verified_hours numeric, completed_activities bigint, badges text[])
language sql stable security definer set search_path = '' as $$
 select dense_rank() over(order by t.hours desc), btrim(p.public_alias), t.hours, t.completed,
 private.recognition_badges(t.hours,t.completed,t.environmental,t.communities)
 from private.recognition_totals t join public.profiles p on p.id=t.volunteer_id
 where p.show_on_leaderboard and nullif(btrim(p.public_alias),'') is not null and t.hours > 0
 order by t.hours desc, btrim(p.public_alias) limit 100;
$$;
revoke all on function public.get_community_recognition() from public, anon, authenticated;
grant execute on function public.get_community_recognition() to anon, authenticated;

create or replace function public.get_public_leaderboard()
returns table(rank bigint, display_name text, community_hours numeric, volunteer_activities bigint)
language sql stable security definer set search_path = '' as $$
 select r.rank,r.public_alias,r.verified_hours,r.completed_activities from public.get_community_recognition() r;
$$;
revoke all on function public.get_public_leaderboard() from public, anon, authenticated;
grant execute on function public.get_public_leaderboard() to anon, authenticated;

create or replace function public.get_my_recognition()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); result jsonb;
begin
 if owner_id is null then raise exception 'Sign in to view your recognition.'; end if;
 select jsonb_build_object(
 'verified_hours',coalesce(t.hours,0),'completed_activities',coalesce(t.completed,0),
 'badges',private.recognition_badges(coalesce(t.hours,0),coalesce(t.completed,0),coalesce(t.environmental,0),coalesce(t.communities,0)),
 'public_alias',p.public_alias,'show_on_leaderboard',p.show_on_leaderboard,
 'rank',(select ranking.position from (
   select x.volunteer_id,dense_rank() over(order by x.hours desc) as position
   from private.recognition_totals x join public.profiles q on q.id=x.volunteer_id
   where q.show_on_leaderboard and nullif(btrim(q.public_alias),'') is not null and x.hours>0
 ) ranking where ranking.volunteer_id=owner_id),
 'history',coalesce((select jsonb_agg(h.record order by h.completed_at desc nulls last) from (
 select r.completed_at,jsonb_build_object('id',r.id,'title',o.title,'municipality',o.municipality,'status',r.status,
 'completed_at',r.completed_at,'hours',case when r.volunteer_hours>0 and r.volunteer_hours<>'NaN'::numeric then r.volunteer_hours else 0 end) as record
 from public.volunteer_registrations r join public.volunteer_opportunities o on o.id=r.opportunity_id
 where r.volunteer_id=owner_id and r.status in ('attended','completed')
 order by r.completed_at desc nulls last,r.id limit 100) h),'[]'::jsonb)) into result
 from public.profiles p left join private.recognition_totals t on t.volunteer_id=p.id where p.id=owner_id;
 return result;
end;
$$;
revoke all on function public.get_my_recognition() from public, anon, authenticated;
grant execute on function public.get_my_recognition() to authenticated;
