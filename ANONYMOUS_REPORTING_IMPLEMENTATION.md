# Anonymous reporting implementation and public-release readiness

2 November 2026. Implemented locally; **not deployed and not approved for public activation**. This supersedes the earlier implementation proposal. No production DDL, writes, Auth changes, bucket changes or billing changes were made.

## Delivered behavior

- Anonymous is the initial identity choice even when an account is signed in. No Auth account/profile is created by visitor submission. Name, email and phone are optional under a separate confidential-contact choice. Switching back to anonymous clears those fields. Existing users can deliberately select their signed-in account instead.
- Reports and optional locations enter the existing `reports`/private-location tables with null reporter identity, pending human review and no publication. The canonical five-argument moderation RPC remains the authority for approval, rejection, priority, verification, internal notes and resident-facing feedback.
- The browser creates a cryptographically random 256-bit bearer tracking credential before submission. It is reused for retries, displayed only in the private receipt and optionally downloaded by the user. It is never placed in a URL, localStorage or sessionStorage. Database storage contains its SHA-256 hash, not the credential.
- Tracking uses a POST body and returns only reference, status, priority, timestamps, resident-facing feedback and status-only events. It does not return report text, contacts, identities, precise coordinates, evidence links, internal notes or moderator identifiers. A guessed report UUID does not authorize tracking. There is no recovery service: the user must keep the private receipt.
- Optional contact is stored in a separate private RLS-enabled table with no browser table grants. A moderator-only RPC checks the protected database staff role before returning contact to the review panel. It is never part of public map data.
- Anonymous evidence is limited to one JPEG/PNG/WebP input of at most 2 MiB. The Node server actually decodes it with a 16-megapixel limit, rejects unsupported/multiple-page images, auto-orients, resizes within 2400×2400 and re-encodes JPEG without original metadata. Sanitized output is also capped at 2 MiB. Existing account-linked uploads retain their existing 5 MiB restrictions.
- A saved report remains a success if a later photo upload fails. The receipt explicitly warns that the photo was not confirmed saved. A retry with the same credential and unchanged payload reuses the report and immutable storage path. A changed payload cannot replace a report using its credential.
- New English, Filipino and Waray labels include anonymity limitations and private receipt handling. Waray translations still need native-speaker editorial review; automated checks do not certify dialect quality.
- Fixed a development-only translation loader defect: browser JSON import assertions conflicted with Vite's development JavaScript MIME response. Development now uses ordinary Vite JSON imports; Node tests and production bundles retain their appropriate asserted path. Browser tests explicitly select and assert Waray rather than relying on a preference alone.

## Files and migration

`api/anonymous.js` is the Vercel Node adapter. `server/visitor-handler.mjs` contains validation, bounded body streaming, image sanitation, origin/source checks and error mapping. `src/lib/visitor-reports.js`, ReportDialog, ReportReceipt and ReportTracking implement the browser path. VisitorContact adds restricted staff follow-up details.

The CLI generated `supabase/migrations/20261102110436_anonymous_reporting_ingress.sql`. It is a single transaction and has been tested against both the complete local migration chain and the inspected legacy shape with the moderation repair already applied. It is **not applied remotely**.

The migration adds private visitor metadata, transaction-bound write context, bounded attempt counters and five narrow public RPCs. It permits null reporter/uploader references without modifying existing rows. A deferred foreign key ties private visitor/contact metadata to its report for explicit future report deletion. It does not delete storage bytes or schedule deletion.

The transaction aborts if the evidence bucket is public or lacks the expected JPEG/PNG/WebP and size restrictions. The submission function rechecks that it remains private before accepting a photo reservation. The Vercel route has a proposed 15-second maximum duration in repository configuration; no runtime configuration has been deployed.

Existing authenticated input, upload, RLS and moderation protections remain. The migration preserves their function bodies and adds a visitor branch that is usable only while a trusted service RPC has created an inaccessible transaction-bound marker for that exact report. Unknown expected guard shapes abort the migration. The optional full-schema input guard is handled separately from the live legacy shape.

## Privileged execution review

Privileged execution is intentional because an account-free visitor has neither an Auth UID nor the ownership privileges to create the report and private metadata. It is not a general RLS bypass granted to visitors.

- Submit, attempt-claim, tracking and photo-finalization RPCs: EXECUTE only for `service_role`; PUBLIC, anon and authenticated grants revoked. The service credential stays in server-only environment configuration. The runtime does not forward browser Auth headers into this client.
- Contact RPC: authenticated EXECUTE, plus an explicit non-null Auth UID and protected `public.is_staff()` authorization check. User-editable metadata is not used.
- New functions: trusted postgres ownership and empty search paths with qualified relations. Updated report guard search paths are hardened to empty as well.
- Private tables: RLS enabled, no anon/authenticated/service direct table grants. A caller-supplied session setting cannot create a write-context row. Rows are removed within the same transaction before success; rollback removes them on error.
- Report publication and reviewer fields are never accepted from visitor input. Exact locations are private; the existing public-coordinate rounding rule remains.
- Public feed: intentionally owner-executed, security-barrier view with a fixed column list and explicit published-status predicate. This privileged read is deliberately bounded to public report fields. It excludes all identity/contact/decision-note fields, and grants only SELECT. An authenticated restrictive policy prevents reading other reporters' UUIDs through the underlying table, while preserving owner and moderator reads. Visitor-enabled frontend map reads use the new view.
- No general report UPDATE grant, RLS disablement or anonymous direct report/bucket insertion is added.

## Limits and financial protections

| Control | Implemented limit |
| --- | --- |
| Visitor submit attempts per source | 5 per conservative 11-minute counter window |
| Visitor tracking attempts per source | 30 per conservative 11-minute counter window |
| Visitor submit attempts globally | 400 per conservative 24-hour-plus-one-minute window |
| Visitor tracking attempts globally | 3,000 per conservative daily window |
| Successful reports per source | 20 per rolling 24 hours |
| Successful reports across existing and visitor paths | 200 per rolling 24 hours |
| Visitor receipts outstanding | 500; fails closed pending an approved retention procedure |
| Attempt-counter rows | 100,000; fails closed rather than silently accumulating indefinitely |
| Shared evidence reservations/objects | 100 total, including legacy objects, account claims and visitor reservations |
| Visitor photo/body | 2 MiB input/output; 2,900,000-byte JSON body |

Transaction-level advisory locks serialize competing report and evidence reservations. Accepted visitor photo reservations continue to count after an upload failure, preventing orphan/retry abuse. Existing account upload checks also include visitor reservations. Attempt quotas are committed separately before image decoding, so malformed submissions and unsuccessful tracking still consume allowances.

Source IDs are HMACs of the transport IP, not raw IPs. They remain pseudonymous information and need an approved retention/access policy. On Vercel only the platform-supplied single `x-forwarded-for` IP is accepted; chains fail closed. On an isolated local host, the socket address is used and forwarded headers are ignored. Shared networks can share a quota. Source changes can evade a per-source quota, so global caps remain necessary. Origin checking prevents browser cross-origin use but is not authentication or a bot defense by itself.

These controls bound application writes and accepted upload reservations, **not all provider invocation, bandwidth or database-request costs**. Requests rejected by quotas can still invoke Vercel and Supabase. No provider spending cap, billing status or maximum monetary exposure has been verified by this task. No paid service, AI call, email call, subscription or billing setting was activated. Sharp is pinned to a reviewed exact package version in the lockfile; it runs locally/server-side and requires no voice/AI API or license subscription.

## Verification and limits

| Check | Result |
| --- | --- |
| Unit/security suite (`npm test`) | 73 passed |
| Anonymous HTTP/SQL/security suite | 10 passed; seven overlap the unit/security suite |
| Existing database integration groups | 8 passed |
| Anonymous database-backed browser | 8 viewport/language cases passed; explicit Waray assertion, map-point preservation, wrong credential and public feed publication included |
| Existing browser regression | 57 checks passed |
| Dedicated database-backed moderation browser | Passed persistence, authorization revocation, error display, notes/audit and reload |
| Existing readiness browser | 14 viewport/theme cases, eight language groups and six public-pause cases passed |
| Translation catalogs | 1,207 keys, no untranslated static JSX labels |
| Lint / production build | Passed |
| Production dependency advisory scan | Zero reported vulnerabilities at this check (`npm audit --omit=dev`); not a guarantee of vulnerability absence |

The Postgres/RLS and React review checklists were applied to the new code. No hosted provider advisor result is claimed for the uninstalled migration.

Automated results are recorded under `test-results.local/anonymous/` and the related ignored log files. The implementation uses real HTTP requests and real isolated PGlite/PostgreSQL writes. The local Storage adapter retains and verifies actual sanitized bytes and matching Storage metadata; it is not hosted Supabase Storage. Browser public SDK reads query the same database through a test adapter; submission success and status tracking come from the actual HTTP endpoint and persisted database records, not hardcoded success messages.

The integration suites cover account-free creation, optional contact, private exact locations, real photos and metadata stripping, idempotent retries, wrong credentials, direct anonymous write denial, RPC execution grants, staff versus resident authorization, approval/rejection/verification/resolution, priority, notes, public-feed projection, account ownership compatibility and concurrent quota claims. Browser checks cover mobile/desktop, English/Waray, cleared contact fields, private receipts, real status reads and no credential/contact storage in browser storage. Existing regression suites cover account-linked workflows and volunteers separately.

**Hosted Auth, Storage RLS and the Vercel runtime/rewrites/forwarded-header boundary still require an isolated hosted rehearsal.** There is no available verified staging project: the earlier free project creation hit the project limit. No existing application was repurposed and no upgrade was purchased. Local tests do not certify those hosted behaviors. Existing read-only live audit confirmed the correct project, legacy guards, policies, bucket restrictions and canonical moderation signature; it did not execute production submissions.

## Privacy and retention decisions still needed

Owner proposals are recorded in `PRIVACY_POLICY_DRAFT.md`: Julius Yexel A. Lorenzana as conditional individual controller, juliuslorenzana1@gmail.com as designated contact, reports/photos two years after closure, moderation three years after closure and a 30-day verified account-deletion handling target. The operator's actual responsibility, working contact receipt/reply and final legal/purpose review remain unconfirmed. No government/organizational affiliation is claimed.

No automatic deletion is installed or enabled. The existing retention tool is metadata-only and cannot delete records. Before implementing destructive workers, resolve open/reopened/abandoned reports, holds and appeals, optional contacts, tracking hashes, source/counter retention, volunteer records, audit copies of report content, provider logs, backup expiry and restore handling. Storage bytes must be removed through the Storage API under an approved procedure; deleting database metadata alone is insufficient. Keep the incomplete notice internal until the actual processing and approved terms agree.

## Exact release sequence — requires future approval

1. Obtain a separate isolated writable Supabase environment or local Supabase stack. Do not reuse the existing unrelated application, delete/pause projects or upgrade a plan to get around the free limit without explicit authorization. Restrict a hosted test website to authorized testers using existing available protection.
2. Reinspect that environment's schema, guard definitions, role ownership, grants, bucket metadata, Storage policies and Auth settings. Confirm frontend and server point to the same backend. Apply the existing reviewed moderation repair first if absent.
3. Apply **only** the reviewed new anonymous migration through the official migration interface, preserving its transaction and schema-cache notification. Do not blindly replay historical migrations against production's incomplete migration history. Rehearse and verify rollback/recovery while the new ingress remains disabled.
4. Configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, a freshly generated high-entropy `ANON_SOURCE_HMAC_KEY` and exact `ANON_ALLOWED_ORIGIN`. Never use a `VITE_` prefix for secrets or put them in Git. For isolated testing, use `ANON_ENVIRONMENT=isolated`, the exact `ANON_STAGING_PROJECT_REF` for a new hosted staging project (not needed for 127.0.0.1:54321), and deliberately enable `ANON_REPORTING_ENABLED=true` only inside the restricted environment.
5. For the isolated frontend, use `VITE_APP_ENVIRONMENT=staging`, the matching separate URL/public key and `VITE_STAGING_PROJECT_REF`, `VITE_ENABLE_ANONYMOUS_REPORTING=true`; account/volunteer tests additionally use `VITE_ENABLE_PERSONAL_DATA_COLLECTION=true`. Keep AI and email switches false. Run `npm ci`, `npm test`, `npm run test:database`, `npm run test:anonymous`, `npm run test:anonymous:browser`, lint, translations, builds and existing browser suites.
6. Run real hosted end-to-end tests with non-sensitive records: no-registration submit, optional contact, tracking, photo upload/access denial, moderator login/revocation, decisions, private notes, public map update and existing volunteer/account flows. Verify the Node request stream, native Sharp package, `/api/anonymous` routing, exact Origin and trusted IP behavior on the actual platform. Check invalid requests and parallel quotas, not just successful UI paths.
7. Finalize the policy/contact/controller/retention decisions and public notice, including native Waray review. Obtain approval for the exact tested production migration, deployable commit and public activation. Git main and review branches currently have deployment guards; do not remove them merely to publish source.
8. After that approval, apply the single rehearsed migration and deploy the reviewed application in a controlled release. The intended production project is `xoitncotbgobcsdmvyjb`. Public frontend activation requires `VITE_APP_ENVIRONMENT=public`, its matching URL/public key, `VITE_PUBLIC_PROJECT_REF=xoitncotbgobcsdmvyjb`, `VITE_PUBLIC_REPORTING_RELEASE_APPROVED=true` and `VITE_ENABLE_ANONYMOUS_REPORTING=true`. Account/volunteer collection also requires `VITE_ENABLE_PERSONAL_DATA_COLLECTION=true`. Server activation independently requires `ANON_ENVIRONMENT=public`, `PUBLIC_REPORTING_RELEASE_APPROVED=true`, exact allowed production origin and `ANON_REPORTING_ENABLED=true`. None of these public approval switches was set by this task.
9. Verify the authorized release with isolated test records, inspect error handling without logging personal data, and retain the rollback point. Do not drop the new nullable identity support after visitor records exist. To stop the new endpoint, disable its approved server enablement switch; note that this pauses both visitor submission and tracking, and does not close pre-existing direct Auth/account paths. A full collection pause remains a separately reviewed provider/database operation.

Public release remains **blocked**, despite the completed local implementation, until the hosted rehearsal and remaining privacy/operational decisions above are satisfied.

## Provider references consulted

- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) and current changelog index: reviewed the browser-role versus privileged execution boundary.
- [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js) and [advanced configuration](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration): the standalone API file uses the Node request/response interface and does not access the lazy request.body helper.
- [Vercel request headers](https://vercel.com/docs/headers/request-headers): trusted forwarding assumption must still be tested on the deployed platform; the local harness does not authenticate that boundary.
- [Sharp output behavior](https://sharp.pixelplumbing.com/api-output/): re-encoding without metadata retention strips original metadata. The installed Sharp package declares Apache-2.0; native dependency license files remain included with their packages.
