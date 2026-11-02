-- REVIEW / EXPLICIT APPROVAL REQUIRED BEFORE ANY PRODUCTION USE.
-- Feature pause, not a destructive schema rollback. Existing records, tracking,
-- moderator review, RLS and the identity-safe public view remain intact.
-- Also disable ANON_REPORTING_ENABLED at the server when a complete visitor
-- endpoint pause is intended; that switch additionally pauses tracking.
begin;
revoke execute on function public.submit_visitor_report(jsonb,text,text,text,boolean) from service_role;
revoke execute on function public.finalize_visitor_photo(uuid,text) from service_role;
notify pgrst,'reload schema';
commit;
