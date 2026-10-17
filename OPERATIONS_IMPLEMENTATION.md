# Operations command implementation

## Current status - 2026-10-18

The local /operations route uses the existing React/Vite application and Supabase backend. The public root remains available. No packages were added. Frontend publication uses the existing GitHub Pages workflow after explicit user authorization.

The approved attendance safeguards have been applied to eastern-samar-test (project xoitncotbgobcsdmvyjb), which matches the local application's configured Supabase URL. Attendance approval is re-enabled in the local workspace after database verification. Staff cannot approve their own attendance or hours through either the RPC or a direct status update.

## Architecture and scope

- Existing Supabase Auth sessions and resident/moderator/admin roles are retained; there is no separate volunteer role.
- Reports, categories, private locations, evidence, moderator notes, report events, screening records, projects, volunteer opportunities, registrations, notifications and leaderboard helpers were inspected in repository SQL. Relevant deployed registration policies, column grants, function definitions, triggers and profile columns were also inspected.
- Existing RLS, restricted column grants, is_staff()/is_admin(), profile role protection and moderate_report() remain the backend authorization boundary.
- Private evidence uses the existing private storage bucket and five-minute signed URLs. Exact private locations are not queried by this workspace; map coordinates are the report's approximate location.
- The existing geoBoundaries province outline is retained and attributed. No municipality coordinates or boundaries were invented. Barangay filters use submitted names and do not imply a verified GIS index.

## Implemented frontend

The staff-only workspace includes a dark administrative shell, province map with category markers, zoom/pan/report focus, report and location search, municipality/barangay/category/status filters, report inspection and status timelines, existing moderation and private evidence workflows, existing volunteer management and attendance tools, municipality report distribution, and a status-history feed that polls every 60 seconds.

Counts reflect up to 500 loaded reports. The feed shows up to 100 status events and is labeled as report history, not a comprehensive administrative audit trail. Failed reads display unavailable or stale-data notices.

The shared profile lookup now retries only missing-column errors when the deployed schema lacks show_on_leaderboard, preserving the user-ID filter and stored role. Other errors fail closed. Own attendance controls are disabled with an explanation in both administrative interfaces; the server independently enforces this restriction.

## Database changes applied with approval

1. 20261017172903_attendance_self_approval_guard: row-locks the target registration and rejects calls when volunteer_id equals auth.uid(), retaining staff checks, status/hour validation, and existing execution grants.
2. 20261017173014_attendance_direct_update_guard: tightens the staff-management policy with volunteer_id <> auth.uid() in USING and WITH CHECK. Separate read and self-cancel policies remain intact.

Local migration versions match the Supabase migration history. Their UTC version prefixes fall on October 17; application and verification occurred on October 18 in Philippine time. Original proposal files are retained for review history; the migrations are the applied source of truth. No other pending migrations were applied, and no existing community records were modified by verification.

## Files created or modified

- src/main.jsx: lazy /operations route.
- src/App.jsx: staff link and current account ID for own-registration controls.
- src/components/OperationsCommand.jsx: authenticated operations workspace and existing backend workflows.
- src/components/operations.css: scoped visual design and responsive layouts.
- src/components/ModeratorDashboard.jsx: own-registration controls and pre-submit check.
- src/lib/reports.js: compatible staff profile lookup.
- tests/profile-access.test.mjs: focused compatibility and failure-path tests.
- tests/attendance-guard-verification.sql: rollback-only role/RPC/RLS verification.
- supabase/migrations/20261017172903_attendance_self_approval_guard.sql.
- supabase/migrations/20261017173014_attendance_direct_update_guard.sql.
- supabase/proposed/operations_attendance_guard.sql and operations_attendance_direct_update_guard.sql: original proposals, now approved/applied through the migrations.
- OPERATIONS_IMPLEMENTATION.md: this report.

## Verification

Live database: all 26 assertions passed. Coverage includes anonymous/resident denial; moderator/admin self-approval rejection; own-hours rejection; approval by another staff member; valid null hours; invalid status and negative hours rejection; missing-registration rejection; direct-update bypass blocking; preserved future self-cancellation; execution and column grants; and zero remaining fixture rows. Fresh users, profiles, activity and registration fixtures and all test writes were rolled back. Tests switched to real anon/authenticated database roles with request identity claims; no browser login or personal account credentials were needed.

Local automated tests: 26 passed across profile access, existing report workflows and email notifications. Production build and lint are run after the final frontend changes; only existing App/VolunteerBoard React warnings and the large main-chunk build warning remain. No TypeScript-check script exists.

## Remaining limitations

The approved backend safeguards are verified. Browser-based signed-in interaction, responsive visual QA and end-to-end private evidence access have not been tested. GitHub Pages deployment is controlled by the existing workflow on main. The live /operations/ static entry and project-base asset paths are included in the deployment build.

Staff assignment, dedicated case references/resolution records, comprehensive tamper-resistant administrative logging, density mapping, verified municipality/barangay GIS layers, verified-hours overview totals, administrative rate limiting and push subscriptions remain unimplemented. The original province boundary and existing authorized report/volunteer workflows are used without fabricating those capabilities.

## Map and interface revision — 2026-10-18

The workspace now uses a dedicated OperationsMap component with native Esri Dark Gray cartography, World Imagery, and a vector-only outline option. Esri and source attribution is rendered on the map. Municipality labels are supplied by the basemap; no geographic coordinates or local boundaries were invented. Public basemap availability depends on the provider; errors leave the province and report overlays available and offer retry/outline controls.

The map includes fractional zoom, province highlighting and an outside-scope mask, category glyphs with distinct status rings, selected-marker emphasis, exact-coordinate report grouping, a category legend, layer controls, scale, north indicator, coordinate/zoom readout, fit controls, and an expanded map with keyboard focus handling. On touch devices, single-finger page scrolling remains available until map dragging is explicitly enabled.

Selecting a report previews it beside the map instead of immediately covering the geography with a modal. The full inspection action remains available, and its review action now opens the matching moderation record directly. The report index has status badges and priority/date sorting. Filters are collapsible on desktop and use a focused bottom sheet on phones. Desktop navigation, center content, and feed scroll independently.

Files added: src/components/OperationsMap.jsx, operations-map.css, and operations-shell.css. OperationsCommand.jsx and ModeratorDashboard.jsx were updated for the interaction changes. This revision made no database, policy, production-data, or deployment changes.

Validation: local production build passes, all 26 existing automated tests pass, and targeted lint passes for the three changed components. Isolated Edge browser checks cover desktop/mobile layout, dark/satellite tile responses, layers, outline mode, expanded map, Escape/focus restoration, and the mobile filter sheet. Staff-shell layout was exercised with an isolated mocked SDK transport and zero records; those checks do not claim an end-to-end authenticated backend session. Temporary QA harnesses are removed after testing.

An additional isolated QA fixture verified that two reports at the same coordinates produce one count marker, both popup records remain selectable, selection updates the report preview, and inspection opens the chosen report directly in moderation. No save was submitted and no Supabase network request was made during the fixture test. No fixture data is included in the production interface.


## GitHub Pages and concurrency verification

The deployment workflow runs 28 report/auth/route tests before building. VITE_BASE_PATH sets the project hosting prefix; the build emits operations/index.html so direct navigation and refresh work on GitHub Pages. Navigation preserves the configured application base.

The opt-in tests/concurrent-reports.mjs runner accepts dedicated resident test credentials over stdin, releases 26 report inserts through one promise barrier, and verifies persistence, private pending status, anonymous isolation and status-history records. It intentionally omits incident coordinates, evidence, notification emails and screening calls. Every generated record is visibly labeled TEST. Results are stored under ignored test-results.local with report IDs for later identification; credentials are never written to those results.
