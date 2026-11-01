# Website improvements upload — 1 November 2026

Branch: `codex/website-improvements-2026-11-01`, based on GitHub's current `main` (`3256952`). The upload contains the accumulated website changes only. Unrelated local game commits, Project Hiram, ZLT diagnostics, generated video/audio, narrator installations, model weights, archives and real environment credentials are excluded. Historical video documentation and rehearsal source scripts remain for existing documentation links and test dependencies; no produced media is included.

Included changes cover English/Filipino/Waray interface translations; resident reporting/profile and map improvements; privacy collection gates; restricted staging tools and access-control SQL; server-enforced upload/report quotas; optional API safeguards; accessibility/responsive changes; and regression coverage/documentation. The quality workflow now explicitly uses an intercepted fixture environment so privacy safeguards remain enabled in normal builds without blocking fictional workflow tests.

The branch-specific `git.deploymentEnabled` entry in `vercel.json` prevents a Vercel Git deployment for this upload branch. The existing GitHub Pages deployment workflow only runs on `main`. This upload does not merge to `main`, deploy a website or functions, apply database migrations, enable AI/email providers, change billing, or establish public-release readiness. A later merge can trigger deployment and requires separate authorization.

Verified locally against this upload snapshot:

- Lint exits successfully, including an explicit source/script/test invocation.
- All 1,169 locale catalog keys pass consistency checks; no missing static JSX labels.
- All 59 unit tests and five isolated WASM PostgreSQL integration tests pass.
- Both Supabase Edge Function sources pass Deno type checking; neither is deployed.
- Production build succeeds. Browser workflow tests use a separate fixture build with intercepted fictional provider responses.
- All four browser suites complete successfully: 57 reported checks covering responsive layouts, submissions, volunteer flows, onboarding, recognition, theme behavior and operations views.
- Candidate credential scan found no OpenAI key, Supabase secret/service-role JWT, GitHub token, AWS access key or private key in the selected upload files. This is a targeted check, not a guarantee against every possible secret format.

The existing release blockers still apply: verified privacy contact, legally responsible operator, approved retention/deletion schedule and genuine isolated staging acceptance. Public personal-data collection must remain disabled until the applicable requirements are met. No billing status is asserted.
