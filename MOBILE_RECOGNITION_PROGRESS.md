# Focused repair — 25 October 2026

Priority: mobile map usability and Community Recognition, followed by category readability and related layout cleanup. No broad visual redesign.

## Root causes

- Mobile map sits after desktop-oriented headings, introductory cards and multiple disclosures; a passing overflow check did not establish first-screen map usability.
- Category-only bottom sheet duplicates sidebar filters; map controls compete for limited space.
- Category names are truncated by legend styles and some database labels differ from the requested readable names.
- Live Supabase lacks recognition RPCs and profile privacy columns. Verified volunteer record count is genuinely zero, so the correct functional result is an empty state, not fabricated rankings.

## Checklist

- [x] Compact first-screen map; full filter sheet and uncluttered navigation.
- [x] All ten full category labels, preserving database slugs.
- [x] Public recognition RPC, privacy opt-in and ranking/tie rules.
- [x] Private recognition summary, badges and contribution history.
- [x] Safe migration tested on fresh and legacy schemas before live application.
- [x] Genuine empty/error/loading states and recognition navigation.
- [x] Browser checks at 320, 375, 390, 430, 768 and desktop; light/dark, filters, touch, dialogs, recognition and permissions.
- [x] 47 unit tests, 3 real PostgreSQL integration tests, clean lint and production build.
- [ ] Main deployment and actual production browser verification.

Existing production records and RLS are preserved. Recognition badges are computed from trusted attendance/completion records; no user can grant themselves hours or badges. Earlier unrelated platform repair migrations remain outside this focused database change.

## Implementation and evidence

- Mobile maps start within the first 220 pixels at all tested compact widths. Supporting content follows the map; header emergency access and map attribution remain visible. Five resident navigation items replace six.
- The filter sheet handles search, municipality, status, date and all ten categories. Draft filters apply and reset together; modal focus returns to the opener. Tablet layouts use the same sheet. Location picking enables map movement.
- Recognition is available at /#recognition and from Volunteer. Public results contain only opt-in aliases, verified hours, completed actions and derived badges. Equal hours share dense ranks. The public list is limited to 100; private totals include all verified records.
- Milestones: one completed action; three completions; three environmental completions; five completions across two municipalities; five completions plus 40 verified hours. Registered, cancelled and no-show records award no credit.
- Private summaries and the latest 100 verified history entries use auth.uid() only. Signing out removes personal content. Existing attendance authorization and RLS remain in force.
- Applied only 20261024183629_community_recognition.sql to project xoitncotbgobcsdmvyjb after fresh/legacy PostgreSQL tests and an idempotent replay. No production test records were inserted. All production public tables still have RLS enabled.
- Actual anonymous HTTP checks: recognition and compatibility leaderboard return 200 with empty arrays; personal recognition returns 401 permission denied. Production has zero verified volunteer records.
- Browser suite: 12 width/theme combinations plus empty, retry and signed-in privacy/history/sign-out scenarios. Existing interface and onboarding suites pass. Screenshots are in gitignored test-results.local/.
- Security advisor adds only the intentionally callable recognition RPC notices. Existing trigger-function exposure and leaked-password-protection notices remain outside this focused repair. The broader platform_statistics migration remains pending.

Run npm run lint, npm test, npm run test:database, npm run build, npm run test:browser. Targeted browser checks: node tests/run-browser.mjs --focused. Real read-only Supabase checks against the compiled app: node tests/run-browser.mjs --live-only.
