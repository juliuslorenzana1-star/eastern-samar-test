# Eastern Samar Community Action Map — audit and implementation

Date: 14 October 2026. Baseline checkpoint: `31ea3c4` (local only).

## Scope and evidence limits

Reviewed React application state and navigation, map and Pulse components, authentication/report/volunteer forms, moderation entry points, theme handling, database access helpers, migration SQL, both Edge Functions, build configuration, and tracked environment-file names. Findings below are source-confirmed unless marked as risks or unverified. No production database, account, SMTP configuration, deployed function, or Vercel configuration was changed or tested. No browser automation capability is available in this session, so responsive, visual, focus, and theme behavior has only been inspected in source.

No critical exploit was established from this review. That is not a certification of the deployed system. Existing SQL protections are evidence of intended enforcement, not proof that production has applied them.

## Findings and priorities

Complexity estimates: small = local change; medium = several components or backend configuration; large = data/architecture work and integration testing.

| ID / severity | Issue and affected file | Evidence and user impact | Recommended solution | Complexity | Status |
| --- | --- | --- | --- | --- | --- |
| S1 / High | Private report remains selected after sign-out — `src/App.jsx` | Auth callback cleared own reports but retained `selected`, allowing the existing detail component to remain visible on a shared screen. This is local UI retention, not a demonstrated unauthorized backend read. | Clear selected details when session disappears. | Small | Fixed in source; browser test pending. |
| S2 / High | Staff records attributed to My submissions — `src/lib/reports.js` | Missing `my_reports` RPC fell back to all RLS-visible unpublished reports. Staff can see other residents' rows, so ownership was ambiguous. | Require ownership-scoped RPC; show a clear failure separately from the public map. | Small | Fixed; mocked regression test passes. |
| S3 / High | Staff self-verification — volunteer attendance migration | `record_volunteer_attendance` checks `is_staff()` but not whether the registration belongs to the caller. | Apply and test the existing proposed self-verification guard after owner approval. | Medium | Confirmed source gap; production exposure unverified; draft unapplied. |
| S4 / High | Durable email safeguards not installed | Local function calls `claim_email_notification`; implementation exists only in `supabase/proposed/`. | Approve and apply reviewed SQL, configure secrets, and deploy function separately. | Medium | Function fails closed; production setup unverified. |
| S5 / Medium | File-content protection depends partly on the browser — report helpers/storage SQL | Browser validates signatures; storage bucket restricts MIME and size, but MIME headers are client-supplied. Signature checks are not full image decoding or malware scanning. | Add trusted image decoding/re-encoding if required by the threat model; retain private storage and limits. | Medium | Potential bypass risk; no exploit demonstrated; unchanged backend. |
| S6 / Medium | Report creation has no durable request idempotency | Each insert receives a new report UUID. UI disable cannot prevent duplicates across network retries or tabs. | First prevent refresh failures from appearing as submission failures; propose a request-key constraint/RPC separately for durable retries. | Medium | Local retry trap fixed; database deduplication still a gap. |
| F1 / High | Report confirmation query cannot read ownership column — email function | Function used authenticated REST filter on `reporter_id`; initial SQL deliberately omits that column from SELECT grants. | Use existing `my_reports` RPC with caller JWT, then match the requested ID. | Small | Fixed and mocked tests updated. |
| F2 / High | Successful insert followed by failed refresh reported as failure — `src/App.jsx` | `createReport()` succeeded before `reloadReports()` could throw back into the form, prompting another insert. | Keep saved report in own-list state and report refresh problems separately. | Small | Fixed in source. |
| F3 / Medium | Map-pin cancellation discards draft — `App.jsx` | Picking hides the form; cancel only cleared picking, unmounting the form because `formOpen` remained false. | Restore the form when cancelling. | Small | Fixed in source; manual interaction pending. |
| F4 / Medium | Phantom map markers — `ProvinceMap.jsx` | `Number(null)` passes `Number.isFinite`, unlike the existing `hasCoordinates` helper. | Reuse the helper. | Small | Fixed; coordinate regression test passes. |
| F5 / Medium | Account-history failure blanks public data — `App.jsx` | A single `Promise.all` combined public reports, categories, and private history. Any rejection discarded successful public results. | Settle requests independently and expose account failure as a separate message. | Small | Fixed in source. |
| F6 / Medium | Profile compatibility — `reports.js` | `fetchProfile()` always selects `show_on_leaderboard`; missing leaderboard migration causes profile/role loading to fail. | Apply approved migration or add a narrowly scoped missing-column fallback. | Small | Unresolved deployment-compatibility risk; schema state unverified. |
| F7 / Medium | Failed leaderboard reads resemble empty results — `VolunteerBoard.jsx` | Load catch emptied results while the empty UI said there were no public community leaders. | Show a distinct error state. | Small | Fixed in source. |
| F8 / Medium | Email acceptance versus delivery — email integration | Provider response is tracked as `accepted`; no signed provider webhook exists to mark delivery or bounce. | Keep acceptance wording; implement verified webhooks before claiming delivery. | Medium | Honest acceptance wording preserved; delivery tracking outstanding. |
| U1 / Medium | Navigation does not identify reports/impact — `App.jsx` | Reports and impact shared map state and the Explore map active indicator. | Track navigation intent alongside current screen. | Small | Fixed for primary navigation; scroll-position syncing remains optional. |
| U2 / Medium | Reporting form lacks grouped guidance — `ReportDialog.jsx` | One long sequence of inputs; file validation happened after submission rather than selection. | Group fields, provide compact section legends, validate photos before preview, and disable in-flight fields. | Small | Implemented; visual QA pending. |
| U3 / Medium | Small volunteer/map labels — `styles.css`, `atlas.css` | Older rules use 7.5–9px labels and narrow touch targets; themes have overlapping hardcoded overrides. | Raise essential labels, use theme tokens and 44px action targets, preserve compact metrics. | Medium | Improved targeted styles; full stylesheet consolidation remains. |
| U4 / Low | Pulse ancillary detail competes with the map | Categories and municipality lists are permanently expanded. | Keep metrics visible; put ancillary sections under a native details disclosure. | Small | Implemented; all metrics and filters retained. |
| A1 / Medium | Modal focus escapes — auth/report/volunteer dialogs | `role=dialog` and `aria-modal` had no focus containment, Escape handler, or opener restoration. | Reuse a dialog focus hook with scroll lock and busy-aware Escape behavior. | Medium | Implemented for auth, reporting, volunteer; moderator dialogs still need the same integration. |
| A2 / Low | Theme radios lack expected keyboard behavior — `ThemeToggle.jsx` | Buttons exposed radio roles but lacked roving tab index and arrow-key selection. | Add arrow keys and Home/End behavior. | Small | Implemented; manual assistive-technology test pending. |
| A3 / Low | Map recenter ignores reduced motion | Focus transitions checked motion preference, recenter transition did not. | Apply preference to recenter animation too. | Small | Fixed in source. |
| P1 / Medium | Large initial JavaScript bundle | Baseline 786.85 kB minified; volunteer and administration components imported eagerly. | Load those screens on demand with a loading state. | Small | Initial JS now 735.45 kB, a 6.5% reduction; warning remains. |
| P2 / Medium | Layered CSS and small-text remnants | `styles.css` and `atlas.css` repeat map, Pulse, volunteer, and dark-mode rules. | Consolidate feature styles incrementally with rendered regression coverage. | Large | Targeted improvements only; broad rewrite deferred. |
| P3 / Low | Existing React lint warnings | Nine warnings: effect-driven state updates and an impurity warning at a focus event helper. | Review lifecycle synchronization without changing backend semantics. | Medium | Unresolved; no lint errors. |
| D1 / Medium | Counts describe loaded data, not an unlimited provincial census | Public feed caps at 500 and own-history RPC at 100; no pagination or exact-total query. | Add explicit loaded-data language now, plan pagination/aggregate semantics separately. | Medium | Loaded-data language added to Pulse; pagination remains outstanding. |
| D2 / Medium | Municipality boundaries unavailable locally | Existing asset is provincial ADM2, not individual municipality polygons. Report centroids are not geographic boundaries. | Obtain appropriately licensed, verified municipal data before introducing boundary selection. | Large | Data gap; no invented boundaries added. |

## Existing protections found in SQL

- `profiles_role_guard` invokes `protect_profile_role`, restricting role changes to administrators for authenticated callers. Adding a self-profile update policy does not by itself bypass that trigger.
- `reports_submission_guard` assigns the authenticated reporter, forces pending/nonpublic status, and rounds public coordinates. Exact locations are stored separately.
- `moderate_report` checks staff server-side; the review-decision migration revokes direct report update/delete permissions and requires resident feedback for rejection or requests for information.
- Report-evidence storage is private, capped at 5 MB, restricted to JPEG/PNG/WebP MIME types, and has owner/staff read policies. Signed URLs expire after 300 seconds.
- Volunteer joins use an RPC, opportunity locking/capacity checks, and a unique opportunity/volunteer constraint. Hours are not client-update-granted. The self-verification gap above still matters for staff.
- Public leaderboard participation defaults off. The proposed alias migration excludes non-opted-in profiles and avoids exposing contact fields.
- `.env` variants are ignored; the tracked environment-file inventory contains `.env.example`. A publishable browser key is not a service-role credential. This was not an exhaustive credential-history scan.
- Automated screening checks authenticated report ownership server-side and treats flags as advisory. No moderator decision is delegated to the AI provider.

## Files changed in this audit pass

| File | Purpose |
| --- | --- |
| `src/App.jsx` | Independent loading, saved-report refresh recovery, selected-data cleanup on sign-out, map-picker cancellation, active navigation, lazy secondary screens. |
| `src/components/ReportDialog.jsx` | Guided field groups, photo validation before preview, submission lock, busy controls, dialog focus hook. |
| `src/components/AuthDialog.jsx` | Dialog focus containment, busy close protection, block mode changes while submitting. |
| `src/components/VolunteerBoard.jsx` | Dialog focus containment and distinct leaderboard failure state. |
| `src/components/ProvinceMap.jsx` | Exclude absent coordinates and honor motion settings for recentering. |
| `src/components/ProvincePulse.jsx` | Native disclosure for category and municipality detail. |
| `src/components/ThemeToggle.jsx` | Accessible radio keyboard controls. |
| `src/lib/useDialogFocus.js` | Shared focus/scroll behavior with cleanup and intro-inert awareness. |
| `src/lib/reports.js` | Remove ambiguous own-history fallback. |
| `src/atlas.css` | Cohesive grouped forms, readable volunteer controls, restrained map surfaces, disclosure and loading styles. |
| `supabase/functions/send-email-notification/index.ts` | Ownership-scoped report lookup without the unavailable column grant. |
| `supabase/functions/send-email-notification/index.test.mjs` | Regression coverage for the ownership-scoped lookup. |
| `tests/report-workflows.test.mjs` | Real report-module tests with injected transport and coordinate/file-validation checks. |
| `SYSTEM_AUDIT.md` | Findings, evidence, implementation inventory, verification limits, and next priorities. |

## Validation results

- Production build: passed after correcting an intermediate malformed edit. No build failure remains.
- Final initial JavaScript: 735.65 kB minified / 218.17 kB gzip, versus 786.85 kB / 229.43 kB baseline. Volunteer and administration now load as separate chunks. Remaining >500 kB warning is reported, not hidden.
- Lint: exit 0, no errors, nine existing React warnings remain.
- Email endpoint: eight mocked tests passed, including auth, UUID validation, ownership denial, stored/escaped content, durable-reservation behavior, rate-limit responses, provider-error redaction, and actual stored registration status.
- Report workflows: four tests passed for ownership-RPC failure, successful saves despite unavailable notification/screening, oversize/spoofed image rejection, and absent coordinates.
- Tests do not execute PostgreSQL/RLS. The rate-limit and duplicate tests mock RPC outcomes; concurrent atomicity remains to be tested against an approved database.
- No TypeScript type-check script is configured. Node 24 strips types for handler tests; that is not a Deno type check.
- Responsive layouts, themes, dialog keyboard behavior, and animation were inspected in source only. Desktop/tablet/mobile browser screenshots and assistive-technology tests remain outstanding.
- No live authentication, report insert, moderation decision, volunteer registration, SMTP send, or delivery test was attempted. No production records were created.

## Next priorities and approval boundaries

1. Review and approve the existing proposed email/privacy SQL, validate it on a nonproduction database, and test resident/moderator permissions including staff self-verification. No migration was applied during this audit.
2. Configure verified Resend sender and Supabase Auth SMTP, then separately authorize deployment of the hardened function. Investigate durable reservations before manually retrying failed/uncertain emails. See `EMAIL_AND_PRIVACY_SETUP.md`.
3. Perform real browser testing at 360px, 768px, and 1440px in both themes; test 200% text zoom, reduced motion, keyboard dialogs, reporting draft preservation, and privacy toggles. Extend focus behavior to moderator dialogs.
4. Address durable submission idempotency, pagination/aggregate counts, missing-profile-column compatibility, and signed delivery webhooks with explicit contracts and integration tests.
5. Consolidate CSS after visual baselines exist, and obtain verified municipal boundaries. No major architectural migration is needed for the implemented improvements.

No changes were pushed, deployed, or applied to a database. The checkpoint captures pre-audit work locally, including the earlier unapplied proposal.
