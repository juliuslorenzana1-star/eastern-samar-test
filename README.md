# Eastern Samar Community Action Map

Eastern Samar Community Action Map is a React/Vite community reporting app with a Leaflet map, Supabase Auth, Postgres-backed reports, and a private evidence bucket. No incident or project sample data is seeded. Public reports remain hidden until an authorized moderator publishes them.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. OpenStreetMap tiles require an internet connection.

## Resident interface

SMART ESTE uses a navy and teal map-centered layout, with a single desktop navigation bar and a five-destination mobile bar. Home, Reports, Volunteer, Community, About, Profile, and My Reports support browser history through URL hashes. Expanded maps include search and category filters. Nearby reports require location permission and use a 10 km radius around approximate public report coordinates; the visitor's location is not stored.

Reporting follows Details → Location → Review and shows a saved record's reference only after the existing Supabase creation flow confirms it. Private photos remain private. Profile contains appearance preferences, personal reports and activities, emergency contacts, and staff tools when authorized. Dark is the initial appearance; Light and System remain available. Existing signup tours and public recognition remain supported, while the timed entry splash has been removed.

Run `npm run test:redesign:browser` against the dev server for responsive layouts, history, nearby permission handling, report failures and confirmation, volunteer registration, and role-based navigation. `npm run test:browser` runs this alongside the existing interface, operations, onboarding, and recognition regressions against the production build. `node scripts/review-redesign.mjs` captures the actual public interface at phone, tablet, and desktop sizes using read-only requests. See `REDESIGN_VERIFICATION.md` for implementation details and verification limits.

## SMART ESTE welcome and tutorial

The community interface centers the street map, with report filters and expanded community insights available on demand. Operations uses the same coastal palette, three primary indicators, a collapsible activity feed, and dedicated mobile navigation. Staff access remains protected by the existing account roles and database policies. Run `npm run test:interface:browser` against the local dev server to check responsive navigation, report filters/details, expandable statistics, operations navigation, and signed-out staff protection using intercepted fixtures only.

New signups receive a SMART ESTE welcome animation and five guided steps: explore the map, submit a concern, track submissions, volunteer, and view community impact. Each step can open the corresponding app feature while keeping the tutorial in progress. A floating **Continue tutorial** control returns to the same step; feature links do not mark the tour complete. The tour can be skipped, navigated backward, or replayed using **SMART ESTE tour** in the footer. It supports keyboard focus trapping, scrolling on small screens, light/dark themes, and reduced motion.

Signup attaches a `smart_este_welcome_version` presentation preference to Supabase user metadata. This is not used for authorization. The tutorial opens after successful signup, including when email confirmation is still required; a reminder explains that submitting reports and joining activities require confirmation and sign-in. The marker also lets the first confirmed session on another browser show the welcome. Completion/skip is remembered per account on the current browser. Existing accounts without the marker are not automatically enrolled and can use replay instead. No database migration or report data is needed.

Run `npm run test:onboarding` for completion and eligibility checks. For local browser QA, start `npm run dev -- --port 5178`, then `npm run test:onboarding:browser`. The latter uses an installed Microsoft Edge browser through Playwright Core; `BROWSER_CHANNEL` can select another installed Chromium channel and `ONBOARDING_TEST_URL` can set a different local URL. Local `.env.local` must configure the existing Supabase client. Tests intercept every Supabase request and simulate signup responses; they never create live accounts, send confirmation emails, or modify live data. Results and screenshots are saved under gitignored `test-results.local/`.

## Backend

The Supabase migrations define resident/moderator/admin roles, report categories and workflow, private exact locations and evidence, moderation history/notes, AI-review flags and runs, possible duplicate links, community projects, volunteer opportunities, signups, notifications, RLS policies, and the private `report-evidence` storage bucket. The initial platform migration has been applied to the `eastern-samar-test` Supabase project; apply newer migrations before deploying matching frontend/function code.

The frontend uses `@supabase/supabase-js` for authentication and RLS-protected database/storage access. Local setup: copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The local `.env.local` is gitignored. GitHub Actions needs repository variables with those same names for Pages builds.

New users register as residents and must confirm their email. The first administrator must be promoted by the project owner in Supabase SQL Editor after that account exists; do not grant staff roles through the public app. The client only uses the publishable key. Never expose a service-role/secret key in frontend code or GitHub Pages variables.

### Optional AI screening

`supabase/functions/analyze-report/index.ts` is an authenticated Supabase Edge Function. Deploy it after applying the AI screening migration. Configure `AI_API_URL` (an HTTPS OpenAI-compatible Chat Completions endpoint), `AI_API_KEY`, and `AI_MODEL` as Supabase Function secrets, then deploy `analyze-report`. Do not add these values to `.env.local`, `VITE_*` variables, or the frontend build.

The function verifies the signed-in reporter owns a still-pending report and sends only its title, description, and category to the configured provider. It stores advisory flags/status for authorized moderators. Missing provider configuration or a provider failure does not block submission; the report remains `pending_review` and unpublished. AI output never approves, verifies, or publishes a report.

### Volunteer activities

Moderators and administrators can publish standalone Eastern Samar activities or link an activity to an approved public report from the moderation desk. They can collect the schedule, municipality/barangay, optional map coordinates, skills, tasks, supplies, and capacity, then review registrations, record attendance/hours, complete activities, or cancel them. Residents browse and filter public activities, sign in to join, cancel their own registration while it is still registered, and see their participation and recorded impact under **My Activities**. Registration rows are private; public totals are returned by aggregate database functions.

Apply `supabase/migrations/202610010002_report_linked_volunteer_opportunities.sql` and then `supabase/migrations/202610010003_volunteer_participation.sql` before using the expanded volunteer experience. The new migration preserves existing opportunities and imports legacy signups as registrations without assuming attendance or awarding hours. Join/capacity checks and attendance authorization run in database functions under the existing resident and moderator/admin roles.

## Mobile map and Community Recognition

The mobile map appears before supporting information and has a full filter bottom sheet. All ten category labels remain readable without changing stored identifiers.

Open **Volunteer → Community Recognition** or `/#recognition` for opt-in contributions. Staff-verified hours determine rank; ties share rank. Signed-in volunteers can view private verified history, milestones and privacy settings. Public recognition is off by default. Zero verified records produce an empty state.

The additive `supabase/migrations/20261024183629_community_recognition.sql` repairs the legacy recognition schema without applying the unrelated platform overhaul. It was applied to the current Supabase project after isolated PostgreSQL tests. See [focused repair evidence](MOBILE_RECOGNITION_PROGRESS.md).

## Security and product limits

- The report form and moderator dashboard are connected to Supabase. Moderation decisions are enforced through a staff-checked database function; internal notes and evidence remain private.
- Evidence is uploaded to a private bucket with client-side signature/type/size checks and storage limits. A server-side image inspection/processing function is not implemented.
- AI screening requires deployment and server-side provider secrets; without them it is marked unavailable and human moderation continues.
- Volunteer listings/signups use RLS-protected tables. Only staff can publish opportunities, only approved public reports can be linked, and each resident can manage only their own signup. Notifications delivery and project management UI remain future work.
- GitHub Pages hosts the frontend; Supabase provides the separate Auth, database, and storage services.
# Platform completion and verification

See [implementation status](IMPLEMENTATION_PROGRESS.md), [deployment gates and exact rollout steps](DEPLOYMENT_READINESS.md), and the [presentation guide](PRESENTATION_DEMO.md). Production database repair and authenticated staging acceptance remain required; local tests are not a claim of live integration.

Run `npm run lint`, `npm test`, `npm run test:database`, `npm run build`, then `npm run test:browser`. The browser runner serves the compiled assets and uses isolated fixtures. `npm run test:public:live` performs read-only checks against the configured backend while a dev server runs on port 5178. Use `npm.cmd` on Windows if PowerShell blocks npm.ps1.
