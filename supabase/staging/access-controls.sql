-- STAGING ONLY: apply after the normal migration chain, never to an existing app.
-- Auth signup must separately be disabled using the provider's supported settings.
begin;
do $$ begin
  if exists(select 1 from auth.users) or exists(select 1 from public.reports)
    or exists(select 1 from public.volunteer_opportunities) then
    raise exception 'Staging restrictions require a new empty project; existing applications are protected';
  end if;
end $$;
create schema if not exists private;
revoke create on schema public from public,anon,authenticated;
create table private.testing_environment(project_ref text primary key check(project_ref not in ('xoitncotbgobcsdmvyjb','egqoczyvhwtujwaflmgz','ztsmtwnmirlqzgnnmuuh')), singleton boolean not null default true unique check(singleton));
create table private.authorized_testers(user_id uuid primary key references auth.users(id), active boolean not null default true);
alter table private.testing_environment enable row level security;
alter table private.authorized_testers enable row level security;
revoke all on private.testing_environment,private.authorized_testers from public,anon,authenticated;
create function private.is_authorized_tester() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.authorized_testers where user_id=(select auth.uid()) and active)
     and exists(select 1 from private.testing_environment);
$$;
revoke all on function private.is_authorized_tester() from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.is_authorized_tester() to anon,authenticated;

-- Add restrictive membership checks without changing the existing ownership,
-- moderation, upload or resource-quota policies.
do $$ declare item record; begin
  for item in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security',item.tablename);
    execute format('create policy staging_tester_access on public.%I as restrictive for all to anon,authenticated using(private.is_authorized_tester()) with check(private.is_authorized_tester())',item.tablename);
  end loop;
end $$;
create policy staging_tester_access on storage.objects as restrictive for all to anon,authenticated
using(private.is_authorized_tester()) with check(private.is_authorized_tester());

-- Definer RPCs can bypass RLS. Guard browser-callable application routines too.
-- Rebuild only this repository's SQL/PLpgSQL routines; exclude extension-owned
-- functions, trigger entrypoints and functions already limited to service_role.
do $$ declare item record; definition text; guarded text; begin
  for item in
    select p.*,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.prokind='f' and p.prorettype<>'trigger'::regtype
    and l.lanname in ('sql','plpgsql')
    and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
    and (has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('anon',p.oid,'execute'))
  loop
    definition:=pg_get_functiondef(item.oid);
    if item.lanname='plpgsql' then
      guarded:=regexp_replace(item.prosrc,'\mBEGIN\M',E'BEGIN\n IF NOT private.is_authorized_tester() THEN RAISE EXCEPTION ''Authorized tester access required'' USING ERRCODE=''42501''; END IF;','i');
      if guarded=item.prosrc then raise exception 'Cannot guard staging routine %',item.proname; end if;
    else
      if item.prorettype='boolean'::regtype and item.proname in ('is_staff','is_admin') then
        guarded:='BEGIN IF NOT private.is_authorized_tester() THEN RETURN false; END IF; RETURN ('||regexp_replace(trim(item.prosrc),';\s*$','')||'); END;';
      elsif item.proretset then
        guarded:='BEGIN IF NOT private.is_authorized_tester() THEN RAISE EXCEPTION ''Authorized tester access required'' USING ERRCODE=''42501''; END IF; RETURN QUERY '||item.prosrc||' END;';
      else
        guarded:='BEGIN IF NOT private.is_authorized_tester() THEN RAISE EXCEPTION ''Authorized tester access required'' USING ERRCODE=''42501''; END IF; RETURN ('||regexp_replace(trim(item.prosrc),';\s*$','')||'); END;';
      end if;
      definition:=replace(definition,'LANGUAGE sql','LANGUAGE plpgsql');
    end if;
    if position('$function$'||item.prosrc||'$function$' in definition)=0 then raise exception 'Unexpected routine body delimiter for %',item.proname; end if;
    definition:=replace(definition,'$function$'||item.prosrc||'$function$','$function$'||guarded||'$function$');
    execute definition;
  end loop;
end $$;
create function public.staging_access() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('authorized',private.is_authorized_tester(),'project_ref',(select project_ref from private.testing_environment),'environment','escam-staging');
$$;
revoke all on function public.staging_access() from public,anon;
grant execute on function public.staging_access() to authenticated;
commit;
