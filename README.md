# Eastern Samar Community Action Map

Eastern Samar Community Action Map is a React/Vite community reporting app with a Leaflet map, Supabase Auth, Postgres-backed reports, and a private evidence bucket. No incident or project sample data is seeded. Public reports remain hidden until an authorized moderator publishes them.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. OpenStreetMap tiles require an internet connection.

## Backend

The Supabase migration is in `supabase/migrations/202609290001_initial_platform.sql`. It defines resident/moderator/admin roles, report categories and workflow, private exact locations and evidence, moderation history/notes, AI-review flags, possible duplicate links, community projects, volunteer opportunities, signups, notifications, RLS policies, and the private `report-evidence` storage bucket. It has been applied to the `eastern-samar-test` Supabase project.

The frontend uses `@supabase/supabase-js` for authentication and RLS-protected database/storage access. Local setup: copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The local `.env.local` is gitignored. GitHub Actions needs repository variables with those same names for Pages builds.

New users register as residents and must confirm their email. The first administrator must be promoted by the project owner in Supabase SQL Editor after that account exists; do not grant staff roles through the public app. The client only uses the publishable key. Never expose a service-role/secret key in frontend code or GitHub Pages variables.

## Security and product limits

- The report form and moderator dashboard are connected to Supabase. Moderation decisions are enforced through a staff-checked database function; internal notes and evidence remain private.
- Evidence is uploaded to a private bucket with client-side signature/type/size checks and storage limits. A server-side image inspection/processing function is not implemented.
- AI and duplicate-review tables are groundwork only. No AI service runs, and no automated report decision is made.
- Notifications delivery, project management UI, and volunteer signup UI remain future work.
- GitHub Pages hosts the frontend; Supabase provides the separate Auth, database, and storage services.
