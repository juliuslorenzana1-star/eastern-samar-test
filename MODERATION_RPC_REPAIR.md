# Moderation RPC contract repair

## Root cause and scope

The deployed frontend connects to `https://xoitncotbgobcsdmvyjb.supabase.co`, confirmed from the browser's outbound request origins without printing credentials. Catalog inspection found only `public.moderate_report(uuid, report_status, report_priority, text)`, with parameter names `target_report_id`, `next_status`, `next_priority`, `internal_note`. The client sends those parameters plus `resident_note`. The five-argument review-decision migration was not applied to this database. API logs also recorded moderation 404 responses. This is a genuine schema/signature mismatch, not evidence that the frontend is pointing to a different project or that a cache refresh alone can repair it.

Migration `20261101154302_moderate_report_contract_repair.sql` is a narrow legacy upgrade. It replaces the old overload with the existing canonical five-argument contract, adds nullable review fields, provides the already-expected `my_reports()` feedback read, and uses the existing canonical `platform_audit` shape. It does not replay historical migrations, backfill report records, change user roles, enable AI/email, or alter billing. It notifies PostgREST to reload its schema cache.

## Separate privileged-execution security review

Retaining privileged execution is necessary for the existing controlled-write architecture: browser roles intentionally have no direct report UPDATE privilege or UPDATE policy, and cannot insert audit/status/internal-note records. Making the RPC invoker-only would either fail or require granting direct moderation writes to the shared `authenticated` role. This repair retains the previously privileged RPC with a bounded review rather than loosening RLS.

- **Ownership:** the function is explicitly owned by the existing trusted `postgres` owner. This is powerful and remains a reviewed trust boundary; only trusted migration administrators may replace it. No browser role gets ownership, CREATE rights or a privileged database role.
- **Identity and authorization:** `auth.uid()` must be non-null. The protected database profile must have role moderator/admin, and its row is share-locked for the transaction. Editable JWT user metadata is ignored. Authorization precedes report lookup, so residents cannot use this RPC to enumerate private IDs.
- **Search path:** empty; application tables, role types, helpers and built-ins are explicitly schema-qualified. There is no dynamic SQL based on caller input in either RPC.
- **Execution grants:** PUBLIC, anon and service_role execution are revoked; only authenticated callers receive the moderation RPC grant and must pass its role check. No unrestricted report write grant or RLS bypass policy is introduced. All existing RLS remains enabled.
- **Concurrency/atomicity:** the target report is row-locked. Status, priority, visibility, review metadata, internal notes and audit changes commit together or roll back together. Existing status events are annotated by new IDs rather than ordering random UUIDs at equal transaction timestamps.
- **Workflow:** existing publishable statuses remain approved/verified/in_progress/resolved. Rejection and requests for information require resident explanations. Moderators must return rejected reports to review before publication; the existing admin exception is retained. Verification and resolution timestamps preserve the established semantics.
- **Audit:** the canonical staff-readable, RLS-protected audit table records moderation including priority-only/internal-note-only decisions. If the canonical general report audit trigger is already present, no duplicate manual audit is written. Internal note bodies remain in the staff-only notes table.
- **Privacy:** legacy table-wide report SELECT grants are removed before adding protected field access. Anonymous clients cannot select reporter IDs, reviewer IDs or resident reasons. Authenticated direct reads exclude the new review fields; `my_reports()` returns only `auth.uid()`'s rows and never reviewer identity. The pre-existing authenticated reporter-ID grant is retained for existing ownership filters and event-policy subqueries; this repair does not expand that legacy privilege.
- **Own-report read:** `my_reports()` requires the authenticated EXECUTE grant, uses an empty search path, filters by a non-null `auth.uid()`, has no caller-controlled owner argument and returns at most 100 rows. Its privileged execution is needed to read the restricted feedback fields without exposing them on every published report.

This is not a blanket endorsement of other legacy SECURITY DEFINER routines. Existing aggregate-role advisories and password-protection findings are outside this repair; see [Supabase function-exposure guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). The intentional privileged moderation entry point may still appear in that advisor; its explicit grant and role check are required parts of this design.

## Frontend behavior

The frontend always sends the canonical five named arguments. It no longer retries an older signature that cannot save resident feedback. A missing RPC displays a database-update message and does not report success; authorization and validation failures remain errors. The existing review dialog closes and refreshes report data only after a successful RPC.

## Verification

See the isolated database and frontend regression tests. They exercise an old four-argument schema, the complete migration chain, repeated repair, moderator/admin/resident/anonymous authorization, publication/rejection, all existing statuses, priority changes, note separation, owner-only feedback, missing explanations, nonexistent IDs, same-transaction status events, and rollback when audit persistence fails. Test identities and reports are fictional. Production records are never used as moderation test targets.

This additive repair creates the canonical audit table on legacy databases. A future broad production repair must reconcile that fact and the already-recorded migrations before running; do not replay the old one-time production repair blindly. The public personal-data collection pause remains in place.

### Verified live application

Applied through the authenticated Supabase migration API as version `20261101154302`, name `moderate_report_contract_repair`. The repository filename is aligned with that official migration record. Catalog verification confirms exactly one moderation signature, the five expected argument names, trusted ownership, an empty search path, authenticated execution and no anonymous execution.

The same rollback verification SQL was first rehearsed on isolated PostgreSQL, then run on the actual backend with new fictional Auth/profile/report records in one uncommitted transaction. Authorized moderator calls exercised approval, rejection, requests for information, return-to-review, verification, progress, resolution, priorities, separate notes and nine atomic audits. Resident/anonymous calls and direct report writes were denied. The transaction was rolled back. Afterward the original counts remained 1 report, 2 status events, 1 moderator note and 10 Auth users; zero fixture audit rows remained. No existing production record or account was a moderation test target, and no fixture identities were retained.

PostgREST verification using the deployed client's public credentials returned HTTP 401 / PostgreSQL `42501` (“permission denied for function moderate_report”) for the exact five-argument request as an anonymous caller, rather than `PGRST202`/404. This confirms cache resolution and anonymous denial without changing a report. Credentials were not printed or persisted in the evidence.

Final local checks: 60 unit tests, six database integration tests, lint, all 1,170 locale keys and a successful production build. The dedicated browser test uses the real repair SQL in isolated PGlite PostgreSQL: it confirms the missing-schema message, denial after a moderator role is revoked, successful verification/urgent priority, separate private and resident notes, exactly one audit and persisted UI state after reload. This test is added to CI as `npm run test:moderation:browser`.
