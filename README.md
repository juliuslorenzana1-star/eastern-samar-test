# Eastern Samar Community Action Map

Eastern Samar Community Action Map is a React/Vite community reporting app with a Leaflet map, Supabase Auth, Postgres-backed reports, and a private evidence bucket. No incident or project sample data is seeded. Public reports remain hidden until an authorized moderator publishes them.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. OpenStreetMap tiles require an internet connection.

## Backend

The Supabase migrations define resident/moderator/admin roles, report categories and workflow, private exact locations and evidence, moderation history/notes, AI-review flags and runs, possible duplicate links, community projects, volunteer opportunities, signups, notifications, RLS policies, and the private `report-evidence` storage bucket. The initial platform migration has been applied to the `eastern-samar-test` Supabase project; apply newer migrations before deploying matching frontend/function code.

The frontend uses `@supabase/supabase-js` for authentication and RLS-protected database/storage access. Local setup: copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The local `.env.local` is gitignored. GitHub Actions needs repository variables with those same names for Pages builds.

New users register as residents and must confirm their email. The first administrator must be promoted by the project owner in Supabase SQL Editor after that account exists; do not grant staff roles through the public app. The client only uses the publishable key. Never expose a service-role/secret key in frontend code or GitHub Pages variables.

### Optional AI screening

`supabase/functions/analyze-report/index.ts` is an authenticated Supabase Edge Function. Deploy it after applying the AI screening migration. Configure `AI_API_URL` (an HTTPS OpenAI-compatible Chat Completions endpoint), `AI_API_KEY`, and `AI_MODEL` as Supabase Function secrets, then deploy `analyze-report`. Do not add these values to `.env.local`, `VITE_*` variables, or the frontend build.

The function verifies the signed-in reporter owns a still-pending report and sends only its title, description, and category to the configured provider. It stores advisory flags/status for authorized moderators. Missing provider configuration or a provider failure does not block submission; the report remains `pending_review` and unpublished. AI output never approves, verifies, or publishes a report.

## Security and product limits

- The report form and moderator dashboard are connected to Supabase. Moderation decisions are enforced through a staff-checked database function; internal notes and evidence remain private.
- Evidence is uploaded to a private bucket with client-side signature/type/size checks and storage limits. A server-side image inspection/processing function is not implemented.
- AI screening requires deployment and server-side provider secrets; without them it is marked unavailable and human moderation continues.
- Volunteer listings/signups use the existing RLS-protected tables. Notifications delivery and project management UI remain future work.
- GitHub Pages hosts the frontend; Supabase provides the separate Auth, database, and storage services.
