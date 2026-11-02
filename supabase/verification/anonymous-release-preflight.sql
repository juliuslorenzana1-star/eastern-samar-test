-- READ ONLY. Use against the explicitly selected intended project.
-- No user records, credential values, server files or provider settings are read.
select jsonb_build_object(
  'postgres_version',current_setting('server_version'),
  'dependencies',jsonb_build_object(
    'moderation',to_regprocedure('public.moderate_report(uuid,public.report_status,public.report_priority,text,text)') is not null,
    'report_guard',to_regprocedure('public.set_report_defaults_and_location_precision()') is not null,
    'report_quota',to_regprocedure('private.enforce_report_allowance()') is not null,
    'evidence_quota',to_regprocedure('private.authorize_evidence_upload(text)') is not null,
    'evidence_metadata_guard',to_regprocedure('private.enforce_evidence_metadata()') is not null),
  'visitor_installed',to_regprocedure('public.submit_visitor_report(jsonb,text,text,text,boolean)') is not null,
  'public_feed_present',to_regclass('public.public_report_feed') is not null,
  'read_contracts',jsonb_build_object('timeline',to_regprocedure('public.report_progress(uuid)') is not null,'statistics',to_regprocedure('public.platform_statistics()') is not null),
  'evidence_bucket',(select jsonb_build_object('private',not public,'max_bytes',file_size_limit,'mime_types',allowed_mime_types) from storage.buckets where id='report-evidence'),
  'public_rls_disabled',(select coalesce(jsonb_agg(c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
  'moderation_anon_execute',case when to_regprocedure('public.moderate_report(uuid,public.report_status,public.report_priority,text,text)') is not null then has_function_privilege('anon','public.moderate_report(uuid,public.report_status,public.report_priority,text,text)','execute') else null end,
  'moderation_authenticated_execute',case when to_regprocedure('public.moderate_report(uuid,public.report_status,public.report_priority,text,text)') is not null then has_function_privilege('authenticated','public.moderate_report(uuid,public.report_status,public.report_priority,text,text)','execute') else null end
) as anonymous_release_preflight;
