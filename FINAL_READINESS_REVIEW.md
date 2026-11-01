# Final interface correction and readiness review

**Disposition: interface corrections verified locally; public launch NOT approved or qualified.**

Project: Eastern Samar Community Action Map — Bridging Citizen Voices and Collective Action.

## Release boundary and rollback

Baseline production commit: `a1b23958b4baa30f3eade49a1d7262f5c582445a`, Vercel READY deployment `dpl_99AAoqEncEWUPHjNYntXxoRAW47g`, serving `https://eastern-samar-test.vercel.app`. Local rollback tag: `rollback/ui-readiness-20261101`. Corrections are prepared on `codex/final-ui-readiness`. **No production deployment, production SQL writes, Auth/billing changes or real account/report test writes were performed in this task.** Generated promotional media remains excluded.

Read-only local preview: `http://127.0.0.1:5193`. It uses the existing application's public read credentials and keeps collection disabled. This is not an isolated writable Supabase test backend. The fixture regression builds and the public-mode build are separate outputs; CI tests intercept all provider traffic.

## UI findings and corrections

The attached brief contained text, without a separate screenshot file. The reported selector problem was reproduced and investigated through source rules, computed dimensions and rendered browser captures.

1. **Selector cascade:** generic `.report-modal select` styling gave the navigation select full-width field sizing and padding; wrapper focus-within and select focus styling added rings. Navigation controls now have their own styles loaded after form sheets. Only the actual native select owns a one-pixel border and a single two-pixel keyboard outline. The native dropdown lists full language names; its compact closed state displays globe/code/chevron. Touch height is 44px, compact width 76–82px, with no bordered/padded outer wrapper. English, Filipino and Waray-Waray — Boronganon remain global preferences.
2. **Report header:** removed its language selector and redundant eyebrow. The title and 44px close control have a stable two-column hierarchy. Step 1/Details, Step 2/Location and Step 3/Review use a consistent three-column progress list with `aria-current`.
3. **Form preservation:** a closed-by-default language setting in the footer changes the same global preference. This is deliberate: modal focus trapping makes the page's global navigation inaccessible while the form is open. It offers an accessible in-dialog escape hatch without placing another primary control beside the title. Text, category, selected image, location and active step are preserved.
4. **Mobile sizing:** a 320px test exposed fieldset/grid intrinsic minimum widths clipping location/date controls. Explicit zero-minimum fieldsets and `minmax(0,1fr)` tracks fix the cause. Duplicate visual legends are now screen-reader-only, while field grouping remains semantic. Form fields share the established light/dark tokens. No new UI dependency was added.
5. **Keyboard/scrolling:** disclosure summaries participate in the focus trap. The report form retains its original external opener through map picking, restoring focus when dismissed. Body scrolling stays locked until the final dialog closes. The modal scrolls within the viewport without clipping controls or adding horizontal overflow.
6. **Public availability:** the large permanent banner becomes a compact expandable availability disclosure. Staging retains its discreet authorized-tester label; only fixture builds say fictional test data. The public site is never mislabeled as an access-controlled test environment. Public account/report entry shows the availability explanation before asking for personal information. Existing server-call guards remain in place.

## Privacy and live backend investigation — read-only

The public frontend connects to the expected Supabase project, `xoitncotbgobcsdmvyjb`. Live catalog/settings checks established:

| Control | Verified finding | Consequence |
| --- | --- | --- |
| Public Auth signup | `disable_signup=false`; email enabled; anonymous sign-in disabled | Signup is still open at the provider despite the frontend pause. HIGH release blocker. |
| Report submission privileges | Authenticated column INSERT privileges remain; direct UPDATE absent | Frontend controls alone are not a server-side collection pause. HIGH release blocker. |
| RLS | No public application table found with RLS disabled | Preserved; no RLS was disabled by this work. |
| Moderation | Exactly the canonical five-argument RPC; anonymous execution denied; empty search path | Previous RPC repair remains present. No replacement or cache write was needed in this task. |
| Review feedback | Anonymous reporter-ID/review-note access denied; direct authenticated decision-note access denied | Owner feedback is read through `my_reports()`; internal notes remain staff-only. |
| Authenticated reporter IDs | Existing authenticated SELECT on `reporter_id` remains | Review/reduce this legacy UUID exposure after ownership/event-policy compatibility work. It does not expose profile names through the self/staff profile policy, but is not a completed anonymity guarantee. |
| Evidence | Private `report-evidence` bucket; 5,242,880-byte maximum; JPEG/PNG/WebP only | Existing upload constraints retained. Real Storage authorization/upload acceptance still needs isolated Supabase testing. |
| API budgets | Both external API controls remain disabled | No AI/email activation or provider test generation. |
| Read RPCs | `report_progress(uuid)` and `platform_statistics()` absent | Current UI has explicit fallback states. Actual timeline/totals readiness is blocked until reviewed schema repair. |
| Privacy authority/contact/retention | No verified working privacy contact, confirmed legal controller or approved retention/deletion schedule supplied | Public-launch blockers remain. No email address, consent, authority or retention period was invented. |

`Julius Lorenzana — Independent Project Developer` remains an internal provisional designation only. This review does not establish the legally responsible personal information controller. There is no published placeholder privacy notice.

## Prepared backend corrections — NOT APPLIED

### Server collection pause

`supabase/proposed/pause_public_collection.sql` replaces the old incomplete RLS-only draft with a review-only trigger guard. It blocks new reports, evidence/location metadata, registrations, new profiles, personal profile edits and evidence object writes, including inserts reached through SECURITY DEFINER RPCs. Existing report moderation remains functional. It neither disables RLS nor grants table writes. The guard is SECURITY INVOKER, uses an empty search path, and needs no privileged table reads or callable browser EXECUTE grant. Tests prove direct submissions, privileged volunteer registration, new account/profile inserts, alias edits and uploads fail while existing moderation succeeds.

**This proposal is not active in production and is not an Auth control.** Separately close public signup using the supported Supabase Auth setting and review the operational effects before release. Do not run the pause against the isolated writable staging environment. Promote approved changes into the appropriate reviewed migration/operator rollout; do not run all historical migrations blindly.

### Missing read RPCs

`supabase/proposed/presentation_read_rpcs.sql` reuses the canonical completion RPC names, argument/return shapes and visibility predicates. It adds no writes or lifecycle-column backfill. Statistics derive the same verification/resolution distinction from existing status/timestamps, so the legacy schema is supported without applying the broad completion migration.

Separate privileged-read review: anonymous clients intentionally receive only published status events and aggregate totals, not private event tables or registrations. Owner execution is therefore bounded to these read projections instead of granting public table access. Both functions have trusted ownership, empty search paths, qualified relations and explicit anon/authenticated EXECUTE grants. Private timelines require the authenticated report owner or a protected staff profile; public timelines omit private states, notes and actor IDs. Non-staff totals exclude unpublished reports and return no private pending count. No dynamic SQL or editable-metadata role check is used. Local tests cover another resident's denial, anonymous/private boundaries, note/identity exclusion, approval versus actual verification and rejection removing public visibility. These intentionally callable read functions may produce Supabase function-exposure advisories; that is not evidence of an unrestricted write grant.

## Test results and their limits

| Test | Result | Evidence/limits |
| --- | --- | --- |
| Unit tests | 60 passed | Client guards, payloads, upload validation, optional API denial and workflow/error handling. |
| PostgreSQL integration | 8 groups passed | Real isolated WASM PostgreSQL, including RLS, quotas, moderation, atomic audit, volunteer capacity/roles, proposed server pause and legacy read RPCs. No production data. |
| Existing browser regressions | 57 checks passed | Responsive navigation, report/volunteer forms, roles, operations, onboarding, themes, empty/error states and recognition. Intercepted fixtures, not real Auth/Storage acceptance. |
| Targeted UI matrix | 14 viewport/theme cases passed | 320, 375, 390, 430, 768, 1024 and 1440px; light/dark; all three languages within each case; all steps, image/form preservation, map picking, bounds, 44px targets, one selector border, focus trapping/restoration. No submitted actions are treated as backend success. |
| Language journeys | 8 scenario groups passed | Page/modal language changes, preserved credentials/consent/report text, translated role workspace and payload identifiers. Intercepted fixtures. |
| Public-mode privacy UI | 6 cases passed | No account/report personal-data fields or mutation requests after blocked entry; compact disclosure; mobile/desktop and both themes. Does not establish provider-side closure. |
| Database-backed moderation browser | Passed | Real isolated repair SQL persists verified status, urgent priority, separate notes and audit, survives reload, and rejects revoked moderator authorization; missing RPC stays an error. |
| Lint / locale consistency / Edge types | Passed | 1,174 locale keys; both Edge sources type-checked without deployment. |
| Build/source scan | Passed | Public and fixture production builds; 162 inventoried application/test/config files at scan time; zero candidate secret patterns, no inline scripts or public source maps. Targeted scan is not a guarantee against every secret format. |
| Real Supabase staging E2E | **BLOCKED / NOT VERIFIED** | No approved separate backend/accounts configured; current organization has two existing active application projects. Earlier free-project provisioning was rejected by its limit. Docker is not installed. Runner stops before test writes. |

Actual hosted registration, sign-in/recovery, evidence Storage upload/access, resident submission-to-map publication and volunteer registration through real Supabase Auth remain **NOT VERIFIED** in this task. PGlite and intercepted browser responses do not replace those acceptance tests. Existing Supabase applications were not repurposed, paused or upgraded. In-app receipts/current status are not proof of external email delivery or a durable notification inbox; external email remains disabled.

## Security/UX/performance coverage

The 28-component inventory covers the public shell, language controls, report forms/cards/receipts/progress, map layers, filters, volunteer board/recognition, resident profile, onboarding, emergency drawer, operations/moderation/audit, statistics, network and error states. Source checks and browser journeys were combined; this is not an exhaustive penetration test or WCAG conformance certification. Core checks follow OWASP ASVS-style categories: server authorization, data isolation, input/file validation, credential handling, abuse limits, error handling and privacy.

User report text is rendered through React; reviewed Leaflet HTML uses controlled glyphs/colors and numeric counts, not raw report prose. Existing server quotas and magic-byte checks remain. Sensitive local offline drafts are browser storage, not encrypted archival storage; retention, shared-device cleanup and account deletion/takedown procedures still require an approved policy and working contact.

CSP remains Report-Only; enforcement must be tested against all map/font/storage origins before rollout. Existing password-protection and intentional privileged-function advisories remain review items. No claim of legal compliance, complete anonymity or being unhackable is made.

The fixture build main chunk is approximately 346.73 kB (102.66 kB gzip); languages remain separate lazy-loaded chunks. Local map/paint/initial-layout-shift samples are retained in `test-results.local/readiness/ui/results.json`. They use intercepted data and blocked external tiles/fonts, so they are **not production performance or real mobile network benchmarks**. No new dependencies, paid services or arbitrary performance guarantees were introduced.

## Required release sequence

1. Review the local UI captures and approve the intended visual result. Keep the deployment at the rollback point until release approval.
2. Confirm the legal controller, functioning rights-request contact and retention/deletion schedule. Approve complete privacy/consent, takedown, account deletion and incident procedures with appropriate advice.
3. Approve and rehearse the provider signup closure and server collection-pause rollout; then verify both API and UI boundaries independently. A discreet message must never substitute for those controls.
4. Review/promote the two missing read RPCs through a narrow migration and verify API cache/visibility without touching real report test targets.
5. Configure a genuinely separate, access-controlled Supabase test backend and designated fictional accounts; complete `STAGING_TESTING.md` / `npm run test:staging`. No paid upgrade or existing service shutdown is authorized by this review.
6. Resolve backend/schema, privacy and critical acceptance blockers, review residual CSP/identity/password/accessibility/performance findings, then obtain explicit deployment approval. Public collection requires its own readiness approval; a website deployment is not that approval.
