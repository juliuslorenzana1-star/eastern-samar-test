-- Run this entire file in one privileged execute_sql request.
-- No schema changes. Every fixture and attempted write is rolled back by a
-- deliberately raised/caught exception, even if a security assertion fails.
-- Only JSON results survive in PL/pgSQL variables and a transaction-local GUC.
do $verification$
declare
  original_role text := current_user;
  staff_a uuid := gen_random_uuid();
  staff_b uuid := gen_random_uuid();
  resident_c uuid := gen_random_uuid();
  activity_id uuid := gen_random_uuid();
  registration_a uuid := gen_random_uuid();
  registration_b uuid := gen_random_uuid();
  registration_c uuid := gen_random_uuid();
  missing_registration uuid := gen_random_uuid();
  results jsonb := '[]'::jsonb;
  test_case record;
  before_row jsonb;
  after_row jsonb;
  actual_state text;
  actual_message text;
  actual_role text;
  actual_uid uuid;
  affected bigint;
  passed boolean;
  fixtures_rolled_back boolean := false;
  fixture_count bigint;
begin
  results := results || jsonb_build_array(
    jsonb_build_object('test', 'anonymous RPC execution revoked', 'passed',
      not has_function_privilege('anon', 'public.record_volunteer_attendance(uuid,text,numeric)', 'EXECUTE')),
    jsonb_build_object('test', 'authenticated RPC execution granted', 'passed',
      has_function_privilege('authenticated', 'public.record_volunteer_attendance(uuid,text,numeric)', 'EXECUTE')),
    jsonb_build_object('test', 'direct status update available for cancellation', 'passed',
      has_column_privilege('authenticated', 'public.volunteer_registrations', 'status', 'UPDATE')),
    jsonb_build_object('test', 'direct hours update not granted', 'passed',
      not has_column_privilege('authenticated', 'public.volunteer_registrations', 'volunteer_hours', 'UPDATE')),
    jsonb_build_object('test', 'direct completion timestamp update not granted', 'passed',
      not has_column_privilege('authenticated', 'public.volunteer_registrations', 'completed_at', 'UPDATE')),
    jsonb_build_object('test', 'direct volunteer reassignment not granted', 'passed',
      not has_column_privilege('authenticated', 'public.volunteer_registrations', 'volunteer_id', 'UPDATE'))
  );

  begin
    -- Clear request identity while the privileged connection prepares fixtures.
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{}', true);
    insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    select fixture.id, 'authenticated', 'authenticated',
      'attendance-verification-' || fixture.id::text || '@example.invalid',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', fixture.display_name), now(), now()
    from (values
      (staff_a, 'Rollback fixture moderator'),
      (staff_b, 'Rollback fixture administrator'),
      (resident_c, 'Rollback fixture resident')
    ) as fixture(id, display_name);

    -- The auth trigger normally inserts these; upsert also validates the FK path.
    insert into public.profiles (id, display_name, role)
    values
      (staff_a, 'Rollback fixture moderator', 'moderator'),
      (staff_b, 'Rollback fixture administrator', 'admin'),
      (resident_c, 'Rollback fixture resident', 'resident')
    on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;

    -- Organizer validation requires a staff identity even for privileged inserts.
    perform set_config('request.jwt.claim.sub', staff_a::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
    insert into public.volunteer_opportunities
      (id, title, description, status, starts_at, registration_open, organizer_id, created_by)
    values
      (activity_id, 'Rollback attendance verification',
       'Temporary transaction-only attendance security verification.',
       'published', now() + interval '7 days', true, staff_a, staff_a);

    insert into public.volunteer_registrations (id, opportunity_id, volunteer_id)
    values
      (registration_a, activity_id, staff_a),
      (registration_b, activity_id, staff_b),
      (registration_c, activity_id, resident_c);

    for test_case in
      select * from (values
        ('anonymous cannot record attendance', 'anon', null::uuid, 'rpc', registration_a, 'completed', 2.5::numeric, '42501'),
        ('resident cannot approve own attendance', 'authenticated', resident_c, 'rpc', registration_c, 'completed', 2.5::numeric, '42501'),
        ('resident cannot approve another volunteer', 'authenticated', resident_c, 'rpc', registration_a, 'completed', 2.5::numeric, '42501'),
        ('moderator cannot approve own attendance', 'authenticated', staff_a, 'rpc', registration_a, 'completed', 2.5::numeric, '42501'),
        ('moderator cannot change own hours only', 'authenticated', staff_a, 'rpc', registration_a, 'registered', 4::numeric, '42501'),
        ('administrator cannot approve own attendance', 'authenticated', staff_b, 'rpc', registration_b, 'attended', 2.5::numeric, '42501'),
        ('administrator can approve another staff volunteer', 'authenticated', staff_b, 'rpc', registration_a, 'completed', 2.5::numeric, '00000'),
        ('moderator can approve resident attendance', 'authenticated', staff_a, 'rpc', registration_c, 'completed', 2.5::numeric, '00000'),
        ('moderator can record attended with null hours', 'authenticated', staff_a, 'rpc', registration_c, 'attended', null::numeric, '00000'),
        ('invalid status is rejected', 'authenticated', staff_a, 'rpc', registration_c, 'invalid-status', 1::numeric, '22023'),
        ('negative hours are rejected', 'authenticated', staff_a, 'rpc', registration_c, 'completed', (-1)::numeric, '22023'),
        ('missing registration is rejected', 'authenticated', staff_a, 'rpc', missing_registration, 'completed', 1::numeric, 'P0002'),
        ('direct moderator self attendance is blocked', 'authenticated', staff_a, 'direct', registration_a, 'attended', null::numeric, 'BLOCKED'),
        ('direct moderator self completion is blocked', 'authenticated', staff_a, 'direct', registration_a, 'completed', null::numeric, 'BLOCKED'),
        ('direct administrator self completion is blocked', 'authenticated', staff_b, 'direct', registration_b, 'completed', null::numeric, 'BLOCKED'),
        ('resident direct self completion is blocked', 'authenticated', resident_c, 'direct', registration_c, 'completed', null::numeric, 'BLOCKED'),
        ('resident direct approval of another volunteer is blocked', 'authenticated', resident_c, 'direct', registration_a, 'completed', null::numeric, 'BLOCKED'),
        ('moderator can cancel own future registration', 'authenticated', staff_a, 'direct', registration_a, 'cancelled', null::numeric, '00000'),
        ('resident can cancel own future registration', 'authenticated', resident_c, 'direct', registration_c, 'cancelled', null::numeric, '00000')
      ) as cases(name, actor_role, actor_id, operation, registration_id, requested_status, hours, expected_state)
    loop
      begin
        execute format('set local role %I', original_role);
        select to_jsonb(r) into before_row
        from public.volunteer_registrations r where r.id = test_case.registration_id;
        perform set_config('request.jwt.claim.sub', coalesce(test_case.actor_id::text, ''), true);
        perform set_config('request.jwt.claims',
          case when test_case.actor_id is null then jsonb_build_object('role', test_case.actor_role)
          else jsonb_build_object('sub', test_case.actor_id, 'role', test_case.actor_role) end::text, true);
        execute format('set local role %I', test_case.actor_role);
        actual_role := current_user;
        actual_uid := auth.uid();
        actual_state := '00000';
        actual_message := null;
        affected := 0;
        begin
          if test_case.operation = 'rpc' then
            perform public.record_volunteer_attendance(
              test_case.registration_id, test_case.requested_status, test_case.hours);
          else
            update public.volunteer_registrations
            set status = test_case.requested_status
            where id = test_case.registration_id;
            get diagnostics affected = row_count;
          end if;
        exception when others then
          get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
        end;

        execute format('set local role %I', original_role);
        select to_jsonb(r) into after_row
        from public.volunteer_registrations r where r.id = test_case.registration_id;

        if test_case.expected_state = 'BLOCKED' then
          passed := (actual_state = '42501' or (actual_state = '00000' and affected = 0))
            and after_row is not distinct from before_row;
        elsif test_case.expected_state = '00000' then
          passed := actual_state = '00000'
            and after_row ->> 'status' = test_case.requested_status
            and (after_row ->> 'volunteer_hours')::numeric is not distinct from test_case.hours
            and case when test_case.requested_status = 'completed'
              then after_row ->> 'completed_at' is not null
              else after_row ->> 'completed_at' is null end
            and (test_case.operation = 'rpc' or affected = 1);
        else
          passed := actual_state = test_case.expected_state
            and after_row is not distinct from before_row;
        end if;
        passed := coalesce(passed, false) and actual_role = test_case.actor_role
          and actual_uid is not distinct from test_case.actor_id;
        results := results || jsonb_build_array(jsonb_build_object(
          'test', test_case.name, 'passed', passed, 'sqlstate', actual_state,
          'message', actual_message, 'affected_rows', affected));

        -- Isolate successful writes and failed security checks from later tests.
        raise exception using errcode = 'ZV001', message = 'Rollback individual test';
      exception when sqlstate 'ZV001' then null;
      end;
    end loop;

    -- This exception always removes all users, profiles, activities and registrations.
    raise exception using errcode = 'ZV002', message = 'Rollback verification fixtures';
  exception
    when sqlstate 'ZV002' then fixtures_rolled_back := true;
    when others then
      get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
      fixtures_rolled_back := true;
      results := results || jsonb_build_array(jsonb_build_object(
        'test', 'fixture setup and verification completed', 'passed', false,
        'sqlstate', actual_state, 'message', actual_message));
  end;

  execute format('set local role %I', original_role);
  select (select count(*) from auth.users where id in (staff_a, staff_b, resident_c))
       + (select count(*) from public.profiles where id in (staff_a, staff_b, resident_c))
       + (select count(*) from public.volunteer_opportunities where id = activity_id)
       + (select count(*) from public.volunteer_registrations where id in (registration_a, registration_b, registration_c))
  into fixture_count;
  results := results || jsonb_build_array(jsonb_build_object(
    'test', 'all fixtures and test writes rolled back',
    'passed', fixtures_rolled_back and fixture_count = 0, 'remaining_fixture_rows', fixture_count));

  perform set_config('app.attendance_guard_verification', jsonb_build_object(
    'passed', (select bool_and((result ->> 'passed')::boolean) from jsonb_array_elements(results) result),
    'tests', results)::text, true);
end;
$verification$;

select current_setting('app.attendance_guard_verification')::jsonb as attendance_guard_verification;
