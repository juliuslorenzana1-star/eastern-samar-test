# Eastern Samar Community Action Map — presentation guide

## Readiness and honest framing

The frontend is implemented and locally verified. The connected production database still needs the reviewed repair in `supabase/proposed/production_readiness_repair.sql`. Do not present authenticated workflows as live-verified until the staging checks below pass. Existing public data is real; browser fixture screenshots are clearly labelled QA fixtures and are not impact evidence.

## Prepare a safe demonstration

1. Use a dedicated Supabase staging project with its own publishable key and approved test accounts: resident A, resident B, moderator, administrator. Never share passwords in slides or commit them.
2. For a new staging database, apply repository migrations in filename order. Provision roles through a trusted database operator, not signup metadata. For the inspected existing production schema, follow `DEPLOYMENT_READINESS.md` instead; its migration history is incomplete.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to staging. Configure Auth site URL and allowed redirects for the staging frontend root. Email confirmation/recovery needs working mail delivery.
4. Run `npm ci`, `npm run lint`, `npm test`, `npm run test:database`, `npm run build`, and `npm run test:browser`. On Windows, use `npm.cmd` if PowerShell blocks npm.ps1. The browser tests use isolated fixtures; they do not write to Supabase.
5. Start `npm run dev -- --port 5178`. Create one clearly titled `[STAGING DEMO]` activity through staff controls, dated in the future, capacity 1, with materials and responsibilities. Create demo concerns using the actual resident form. Do not seed production or pad statistics.

## Journey 1: resident reporting

Sign in as resident A. Choose **Report a Concern**; enter a title, category, description and municipality. Choose a point on the map, return to the form, and optionally attach a JPEG/PNG/WebP under 5 MB. Submit once. Show the saved concern under **My submissions** with pending review. In a separate guest browser, confirm it is absent from the public map. Explain that supporting evidence and exact coordinates remain private.

## Journey 2: moderation

Use a separate moderator browser. Open **Administration** or `/operations/` → **Review queue**. Inspect the concern and private evidence, record an internal note, and choose **Verified**. Show the resident's updated review state and the public concern after refresh. Show that verification leaves resolution **Open**; then demonstrate **In progress** and **Resolved**. Rejection and clarification require a separate resident-facing reason. Internal notes must remain absent in the guest view. Staff audit history records actors and timestamps.

## Journey 3: public map

Open a signed-out browser. Select a municipality in report filters and show the map fitting its real polygon even where no concern exists. Filter by category/status/date, open a report popup, then **View Details**. Explain approximate public coordinates, source attribution, the timeline and distinct verification/resolution labels. Show dark/light theme persistence. The map includes all 22 municipalities and Borongan City; verified barangay polygons are not available.

## Journey 4: volunteering

Resident A opens **Volunteer**, selects the staging activity and registers. Show the stored registration in their activity history and in the staff participant manager. Resident B attempts the capacity-1 activity and is refused. Demonstrate cancellation before the start, then registration by resident B. Staff records attendance/hours; volunteers cannot approve themselves. Opt into the leaderboard using a public alias and show opt-out. Do not expose private contact information.

## Trust and operational notes

- Refresh public views after moderation; automatic polling runs every minute in visible tabs.
- Public totals exclude private reports. Staff totals include authorized private concerns. Filtered charts describe loaded records, not province-wide impact.
- AI flags are advisory and human-reviewed. An unavailable or unconfigured service must be presented as unavailable, never as a successful verification.
- Reports are not an emergency dispatch service. The hotline drawer only publishes source-backed contact data; unsourced legacy local numbers are withheld pending verification.
- Offline drafts are scoped to their originating account and device. Photos are not saved offline. Use **Sync Now** when connected or **Delete drafts** to remove them.
- If live auth, mail, storage or database steps fail, show the error and postpone that portion. The isolated SQL/browser tests are rehearsal evidence, not proof of production integration.
