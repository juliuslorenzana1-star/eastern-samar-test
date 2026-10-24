# Deployment readiness — 25 October 2026 (Philippine time)

## Current disposition

Frontend build and local verification pass. **Production integration is not yet qualified.** No production deployment, migration, credentials or account roles were changed. Preview creation was attempted on the existing Vercel project, but both file upload and direct deployment returned HTTP 403 even after the user reported approving the team consent link.

- Vercel project: `prj_cUWQhH3NFDe5Jfe4KZAq77IQCaRw` (`eastern-samar-test`).
- Owning team: `team_UBwUQgGSTrkPJ6O7I1QmOrJ8`, scope `ke-6937`.
- Existing production deployment: `dpl_GzguegPoEWwjB5NrXmbN63xD7DVM`, commit `b6025fe2c0ac4ec28c39e1abe33f91917db4ea24`.
- Supabase project: `xoitncotbgobcsdmvyjb`.
- Working branch: `codex/platform-completion`.

## Verification evidence

| Check | Result | Scope |
|---|---|---|
| `npm run lint` | Pass, no warnings | Application, functions, scripts and tests |
| `npm run typecheck:functions` | Pass | Both Edge Functions on Deno 2.9.6 |
| `npm test` | 47 passing | Unit/transport and notification tests |
| `npm run test:database` | 2 passing | Real isolated PostgreSQL via PGlite; all repository migrations and a reconstructed legacy production schema |
| `npm run build` | Pass, no chunk warnings | Vite 8.3.5; largest JS chunk ~293 KB, ~96 KB gzip |
| `npm run test:browser` | 24 passing scenarios | Built static frontend; intercepted local fixtures; desktop/tablet/phone, light/dark, filters, staff access, tour and restoration |
| `npm run test:public:live` | Pass for public reads and UI | Actual Supabase GETs, municipality navigation, theme persistence, sourced hotline dialog; new totals RPC returns 404 until installed |
| `npm audit` | 0 vulnerabilities | Locked dependencies |

This JavaScript frontend has no TypeScript type-check target. Vite validates JSX compilation. Deno 2.9.6 type checking passes for both Edge Functions via `npm run typecheck:functions`; live Edge Function delivery was not performed. PGlite verifies actual SQL/RLS, not Supabase Auth, HTTP gateway, storage service uploads, SMTP or simultaneous independent database connections. Capacity is protected by the existing opportunity-row lock; sequential capacity/duplicate checks pass, but a live concurrent-session load test remains a staging acceptance gate.

Browser evidence is under ignored `test-results.local/`: `interface-results.json`, `smart-este-results.json`, screenshots and `live-public-results.json`. Browser fixture reports are labelled QA fixtures and are not production records or impact statistics.

## Database rollout: do not push historical migrations blindly

Read-only inspection found all 14 public tables using RLS, ten active categories, a private evidence bucket with a 5 MB limit, and the two attendance guards already applied. Only `20261017172903` and `20261017173014` were recorded in migration history, although base/volunteer objects were manually provisioned.

Missing production pieces include `my_reports`, review-decision fields/new moderation RPC, AI review runs, leaderboard privacy/alias support, public progress/totals RPCs and durable email reservation. Anonymous SELECT on `reporter_id` was also present. An unqualified `supabase db push` could attempt to recreate existing types/tables.

1. Obtain explicit production migration approval, take a database backup, and first rehearse on a disposable staging copy with equivalent schema and roles.
2. Run `node scripts/prepare-production-repair.mjs`. Review `supabase/proposed/production_readiness_repair.sql`. It is one guarded transaction for the inspected legacy shape; it aborts if its expected volunteer functions are missing or the audit table already exists. It adds fields/functions/indexes and tightens anonymous identity access. It preserves records and existing report timestamps. It is intentionally a one-time repair, not a rerunnable seed.
3. Have the authorized database operator run that exact SQL against staging, then verify the four journeys in `PRESENTATION_DEMO.md`, direct unauthorized requests and storage restrictions. Only after approval repeat against the intended production project.
4. Confirm API schema reload and the presence of `my_reports`, five-argument `moderate_report`, `report_progress`, `platform_statistics`, `get_public_leaderboard`, `claim_email_notification`, `platform_audit` and `email_notification_log`. Verify anonymous access to reporter IDs, private locations, notes and registration identities is denied. The authenticated `reporter_id` grant remains for existing policy subqueries/legacy clients; the frontend never selects it for public presentation.
5. Reconcile migration history only after comparing actual definitions to the repository. Mark versions applied only when their full contents are present. Do not mark all versions applied as a shortcut; future schema changes should use a reviewed baseline/diff.
6. For a truly empty new staging database, apply all files in `supabase/migrations` in filename order instead of the legacy repair. Do not apply both paths to the same database.

New migration: `20261024172951_platform_completion.sql` (filename generated by Supabase CLI). It adds distinct verification/resolution state, submission duplicate/rate guards, privacy-preserving progress/totals, explicit leaderboard aliases, staff-only audits, durable email reservations, lookup indexes and trigger-function execute revocations. Existing reports stay private/public according to the existing authorized workflow. Verification does not imply resolution. Internal notes never enter public timeline output. The isolated tests also confirm the legacy repair refuses an accidental second application.

The live security advisor reports intentionally callable role/aggregate RPCs, unnecessarily callable trigger functions, and disabled leaked-password protection. The repair revokes trigger API execution; policy helpers and carefully scoped public aggregates keep required grants. Review password protection in Auth settings if available on the current plan. Advisor references: [function exposure](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS execution plans](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan). No measured production performance improvement is claimed before rollout.

## Environment, Auth and optional services

- Client: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (legacy `VITE_SUPABASE_ANON_KEY` supported). Build-time checks reject secret/service-role credentials in client variables. `.env.local` is ignored; only `.env.example` is tracked. Dependency versions are pinned.
- Supabase Auth: set the approved frontend root as Site URL and allow the exact staging/preview/production root redirect URLs used by signup/recovery. For the existing deployment this is `https://eastern-samar-test.vercel.app/`. Add a particular preview URL after it exists; avoid overly broad production redirect wildcards.
- Set up working signup/confirmation/recovery email through the authorized Auth mail provider. Validate sign-in/out, confirmation and recovery using designated staging accounts. No account passwords were supplied in this session.
- Optional submission/activity email uses `send-email-notification` and server-only `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `APP_URL`, plus Supabase server variables. Apply durable reservation schema before enabling it. Never put these secrets in VITE variables. Mail acceptance is not inbox-delivery proof.
- Optional screening uses `analyze-report` with server-only `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`. Leave it unconfigured unless an approved provider is already available. Unavailable screening is explicitly advisory/unavailable and does not block saving or human review. No paid provider was added or configured.
- Storage: keep `report-evidence` private, JPEG/PNG/WebP only, 5 MB maximum, with owner/staff policies and short-lived signed URLs. The frontend validates signatures and sizes. Verify actual storage upload/download with staging accounts before qualification.

## Preview deployment and final acceptance

The compiled artifact is staged locally under ignored `test-results.local/preview-artifact-*`; `scripts/preview-artifact.mjs` reads compiled public assets only. No preview URL was created: Vercel rejected `POST /v2/files` and `POST /v13/deployments` under scope `ke-6937` with 403. Team access confirmation in chat did not result in API authorization. Complete the consent flow as a team member with the intended Vercel account; a team owner may need to resolve the connector grant. The connection can then retry the same existing project/team. Do not create another project or change production to bypass the error.

Alternatively, an already-authorized local operator can use Vercel CLI: inspect `vercel deploy --help`, link this directory to the exact existing team/project if necessary, then run `vercel deploy --target preview --scope ke-6937`. Configure the preview to use staging Supabase when testing writes. Do not run `--prod`. Validate root/assets and `/operations/`, Auth redirects, public read filtering, all four staging journeys, and the complete registration-capacity race with independent sessions. Promote only after explicit production approval and acceptance.

## Remaining limitations

- Production migration approval and a staging/backend rehearsal are outstanding; live authenticated submissions, moderation, storage and volunteer writes are not claimed as verified.
- Preview/team API authorization remains blocked despite the reported consent approval.
- Verified barangay polygons have not been acquired. Municipality polygons are source-backed 2020 reference boundaries; see `src/assets/GEOGRAPHY.md`.
- Unsourced inherited local hotline numbers are quarantined in `src/data/emergencyHotlines.js`. Only source-backed entries from `sourcedHotlines.js` are rendered. Their source was checked, not telephone availability.
- Mobile/desktop Chromium coverage passes. Physical iOS/Android and WebKit-specific checks remain a release-device acceptance task.
- Public totals are database-wide; visible charts are explicitly based on loaded records. Reports load in 500-record pages and lists render 30 at a time. Automatic refresh returns to the newest page.
