# Full Supabase integration proof and production handoff

2 November 2026. **Full containerized integration passed. Production migration and public activation have not been performed.**

## Testing limitation resolved

The Windows machine has no Docker/Podman installation and no installed WSL distribution; Windows reports firmware virtualization unavailable. The prepared local CLI start was actually attempted and failed at the missing Docker executable. No firmware setting, Windows feature, project, plan or billing setting was changed.

Instead, the real Supabase stack ran in an ephemeral standard Ubuntu GitHub Actions runner for this public repository. This uses no additional Supabase project and no production credentials. No caches or artifacts are uploaded by the new job, and it has no deployment step. [GitHub documents standard public-repository runner usage as free](https://docs.github.com/en/actions/concepts/billing-and-usage). This is not an audit of actual billing records or a claim that every existing provider cost is zero.

**Passing run:** https://github.com/juliuslorenzana1-star/eastern-samar-test/actions/runs/41446985460

**Tested code commit:** `7cbf94cabf8b0759479a0bde34fe9f022aa63935`, branch `codex/full-stack-verification`. Subsequent changes to this report or privacy decision wording do not change the tested runtime implementation.

The job starts dedicated loopback-bound containers for PostgreSQL, GoTrue/Auth, PostgREST, Storage, gateway and local SMTP. It applies the complete application migrations, including anonymous ingress and the new public read repair. Edge runtime and external AI/email functions stay disabled. Credentials are consumed in memory and normal CLI credential output is suppressed. The application endpoint is the actual `api/anonymous.js` adapter with real Supabase clients; neither Auth responses nor uploads are replaced by fixtures. The test stack is stopped without deleting unrelated data or touching a hosted project.

## Verified working behavior

- Account-free anonymous creation, private pending state, optional confidential contact, exact-location privacy and unguessable private tracking.
- Real Storage API upload, persisted image bytes, JPEG re-encoding and metadata removal, immutable retry paths and report idempotency.
- Public signup closed while designated password login works. The first run caught a real configuration defect: disabling the local email provider also disabled password login. The fixed configuration uses global signup closure with the email provider enabled. User-editable role metadata cannot authorize moderation.
- Real Auth sessions and database RLS reject ordinary residents' moderator/contact access and private-image access. Authorized moderators can obtain a working signed evidence URL. Direct anonymous table writes, downloads and protected RPC execution fail.
- Approval, rejection, verification, progress/resolution, priority changes, separate private/resident notes, immediate role revocation and approved public-feed visibility persist.
- Existing account-linked reporting, photo upload, owner history and volunteer creation/registration still work through real APIs.
- Real browser submissions/photos/tracking at 320, 390 and 1440 pixels, including asserted Waray. A moderator signs in through the real browser login, verifies an anonymous report and the public browser map/list receives the published concern.
- Canonical `report_progress` and `platform_statistics` resolve through actual PostgREST, exclude private notes/actors, and do not expose pending-report counts to the public.
- Twelve concurrent real PostgREST quota claims produce exactly five accepted claims. The reversible write pause denies new service submissions while preserving records and existing tracking.

Local regression checks also passed: 73 unit/security tests, eight existing database groups, ten anonymous/security integration tests, lint, 1,207 translation keys and the production build. Seven anonymous security tests overlap the unit suite; these totals are not presented as disjoint. Existing broad browser coverage is documented in `ANONYMOUS_REPORTING_IMPLEMENTATION.md`.

## Concrete changes ready for review

- `scripts/full-stack/local-stack.mjs`: pinned CLI, dedicated unlinked workspace, loopback Docker network, closed signup, real service startup and credential-safe diagnostics. No reset, hosted link, upgrade or hosted migration command is supported.
- `scripts/full-stack/verify.mjs`: real full-stack API/browser/security test and reversible pause rehearsal. A minimal local tester marker validates real signed-in UIDs for the existing staging login UI; it is test-only, not a production migration or simulated login.
- `.github/workflows/quality.yml`: manual `full_supabase=true` job on a standard public Linux runner; ordinary jobs are skipped on this proof branch to avoid unnecessary duplicate work.
- `supabase/migrations/20261102110436_anonymous_reporting_ingress.sql`: previously prepared anonymous system, now also proven on the complete real stack.
- `supabase/migrations/20261102124056_public_read_contracts.sql`: CLI-generated narrow repair for the two missing legacy public read RPCs. Reuses the canonical names/return types and preserves bounded public projections; no historical migration replay or data backfill.
- `supabase/verification/anonymous-release-preflight.sql`: catalog/bucket-only checks that were actually run read-only against production.
- `supabase/proposed/pause_visitor_ingress.sql`: reviewed feature pause, tested in isolation. It revokes only visitor submit/photo-finalization execution from the service role, not existing tracking or moderation. It does not delete records or reverse nullable identity support.
- `VITE_USE_PUBLIC_REPORT_FEED=true` can select the identity-safe public read view independently of enabling visitor submissions. This supports a read-only release after the migration and avoids coupling public map compatibility to collection activation.

## Production checks completed without writes

Project `xoitncotbgobcsdmvyjb` reports PostgreSQL 17.6. The existing five-argument moderation RPC, report default/quota guards and evidence quota/metadata guards are present. No public application table was found with RLS disabled. The evidence bucket is private, limited to 5,242,880 bytes and JPEG/PNG/WebP. Moderation EXECUTE is denied to anon and granted to authenticated, with authorization inside the function.

The visitor migration and public feed are absent remotely, as expected. The two public read RPC repairs remain unapplied. The current Vercel production environment lists only the existing Supabase URL and publishable-key variables. No new service secret, source HMAC secret or release/collection flag is configured. No secret values were decrypted or printed.

PostgreSQL settings read back as `log_statement=ddl`, `log_min_duration_statement=-1`, `log_parameter_max_length=-1`, `log_parameter_max_length_on_error=0`. These settings are not a provider log-retention schedule and do not prove that Auth, Storage, gateway, Vercel or backup systems collect no identifying data. Provider backup/log retention and operational access remain unverified and must be reviewed separately. No settings were changed.

## Hosted isolation assessment

A new schema inside the existing project is not an adequate substitute for a separate Auth/Storage environment. The application's functions, enums, role checks and relations explicitly use public/auth/storage schemas; Auth providers, user identities, bucket service, credentials, logs and project usage are shared. Renaming application tables would not isolate those controls, and testing shared settings could affect the existing application. No production test schema or bucket was created.

The successful Docker proof exercises real Supabase components, but it does **not** certify managed-project API exposure, the live Vercel trusted-IP boundary, production secrets, signed URL behavior at that project's gateway, or provider log/backup retention. These remaining provider-specific checks require a separately authorized protected production rehearsal with fictional records. Another paid project is not required for the completed integration proof.

## Privacy decisions and deletion consistency

The supplied details remain proposals: Julius Yexel A. Lorenzana as individual operator/controller, juliuslorenzana1@gmail.com as privacy contact, reports two years after closure, photos up to two years after closure, accounts until a verified deletion request with a 30-day processing target subject to legal exceptions, moderation three years after case closure. No government affiliation is claimed.

Controller confirmation, actual contact receipt/reply, final notice/purpose/lawful-basis review and legal exceptions are **not marked complete**. Source HMACs, tracking hashes, optional contacts, unresolved/reopened cases, volunteer records, audit copies, technical logs, backups and restoration handling still need a final approved operational schedule. No duration was invented for these categories.

Automatic deletion remains absent/disabled. The retention tool is metadata-only. A reviewed manual deletion must inventory private evidence paths first, honor justified holds, remove image bytes through Storage's API, then remove/anonymize the approved database information, review audit copies, verify public removal and record backup expiry/restore suppression. Account deletion requires session handling and dependency review; dropping an Auth user alone neither erases all related data nor immediately invalidates every issued access token. No user deletion or cleanup was tested on production. Incomplete policy text remains an internal draft.

## Exact production actions still requiring approval

1. Confirm the final operator, functioning privacy-contact process, retention/exception rules and approved notice. Native Waray review is still appropriate; automated language tests do not certify dialect quality.
2. Authorize the **two exact migrations above**, the compatible application commit and a protected smoke test using only separately identified fictional records. This approval must explicitly cover production changes/testing; the current task forbids performing them without it.
3. Re-run the read-only preflight and capture the current deployed rollback point. Deploy the compatible frontend/server with public collection switches still off. Apply only the two reviewed migrations through the official migration interface, preserving their transactions and schema-cache notifications; do not blindly `db push` historical migrations against the legacy project's incomplete history.
4. Configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, a newly generated source HMAC key and exact allowed origin using protected Vercel variables. Do not put secrets in VITE variables, Git, chat or logs. Use the identity-safe feed flag after its view exists, while new collection remains disabled. Protect a preview/rehearsal deployment from public access before testing against the intended project.
5. Perform the approved production-specific smoke test: API/RPC cache, real moderator login, upload/signed URL denial and access, trusted forwarding/origin, private pending report, non-public moderation, tracking, public projection and regression reads. Keep fictional production records private: do not approve/verify/publish them into the real public feed. Full publication was tested in Docker; verify the managed public projection with read-only existing public records unless a separately reviewed quarantine is implemented. Keep the public production deployment's reporting switches off during this rehearsal. For a protected preview using the intended backend, its server target and preview-only enablement must be explicitly approved; do not mislabel production as isolated staging.
6. After those results and final privacy decisions are accepted, obtain separate approval to set the server and frontend public-release/collection switches and open reporting. Keep optional AI/email processing off. Check provider usage safeguards separately; application quotas are not a financial spending cap.
7. If the new write path must be paused, use the tested narrow RPC pause under authorization. Keep the read projection, RLS, tracking and moderation intact. Do not drop visitor tables or re-add NOT NULL constraints after anonymous rows exist. A full endpoint disable also disables visitor tracking; closing all pre-existing account collection would be a broader separately reviewed operation.

GitHub `main` and the live site remain at the previously approved deployment. The new work is on the deployment-disabled review branch. No production migration, public activation, billing change, purchase or project deletion occurred in this task.
