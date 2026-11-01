# Restricted functional testing

No new backend has been provisioned or deployed yet. Existing application projects are protected and must never receive these staging policies or test records.

Proposed dedicated project: **eastern-samar-staging**, region **ap-southeast-1**, organization `fmdhegkubqykvcxftiym`. Supabase's `get_cost` quoted a new project at **$0/month** on 1 November 2026. This is a provisioning quote, not verified actual billing or a promise of unlimited usage. Project limits may prevent creation. No upgrade, paid branch or paid integration is authorized. The owner approved the $0 quote; creation was attempted and Supabase rejected it because the account has reached its two-active-free-project limit. A fresh project list confirmed that no new project exists. Neither active project was paused, deleted, upgraded or modified.

## Isolation and access

- A separate Supabase project, empty schema, separate private evidence bucket, separate Auth accounts and publishable key. Never copy production citizen records or reuse production credentials.
- Apply the repository migration chain only to that empty dedicated project. Then apply `supabase/staging/access-controls.sql` once. Do not use the legacy production repair on a new database.
- The staging SQL adds restrictive tester membership policies to all public tables and Storage, preserving existing ownership/role/quota policies. Browser-callable application RPCs also check membership, including SECURITY DEFINER routines that could otherwise bypass RLS.
- Trusted operator inserts exactly one approved project ref into `private.testing_environment` and the designated Auth user IDs into `private.authorized_testers`. Never grant testers direct access to these private tables. Set moderator role through the trusted operator, never signup metadata.
- Disable public signup and anonymous sign-in using supported Supabase Auth settings **before distributing the testing URL/key**. Use operator-provisioned, fictional resident A, resident B, moderator, administrator and an unallowlisted negative-test account. No public registration or recovery email tests without separate approval.
- A public map in this environment means the map visible to authorized testers. Anonymous users and unallowlisted authenticated users must not read its records or call its application RPCs. Keep the frontend on loopback; any later shared deployment needs explicit approval and access protection.

## Local frontend

Use `.env.staging.local` with staging URL/key, exact `VITE_STAGING_PROJECT_REF`, `VITE_APP_ENVIRONMENT=staging` and `VITE_ENABLE_PERSONAL_DATA_COLLECTION=true`. This opt-in is restricted to a distinct staging identity or the loopback Supabase stack. Setting the old collection flag against production no longer enables public collection.

The interface retains normal branding and the official tagline, with only a discreet testing label. Ordinary application code performs Auth, REST/RPC and Storage requests; it does not install the presentation fixture transport or synthesize successful writes. Presentation capture scripts remain separate and are not the staging entry point.

AI screening and external email functions stay disabled. In-app submission receipts/status history are real database-backed feedback. External email delivery is a separate unverified feature until specifically authorized/configured; no paid email service or AI function is deployed here.

## Verification gates

1. Verify isolated project identity and closed signup before any test write.
2. Sign in using designated accounts, not injected tokens or frontend-only role flags.
3. Resident submits a uniquely titled non-personal report, selects a real map point and uploads a non-personal PNG. Verify its row, private location, Storage object and metadata independently through authorized reads.
4. A second authorized resident cannot read private evidence or an unpublished report. Anonymous and unallowlisted clients cannot access test records/RPCs.
5. Moderator verifies via the actual UI. Reload/independent reads must show persisted verification and public-to-testers publication; ordinary residents cannot moderate.
6. Staff creates an activity through the actual staff form. A resident reads details, checks consent and joins through the real UI. Verify the registration row; duplicate/capacity/unauthorized role checks remain enforced.
7. Reload My Reports and the public-to-testers map to verify status and timeline. Test logout/session restoration and mobile navigation. Do not treat missing email as delivered.
8. Run unit, isolated SQL, regression, language and real staging end-to-end suites. Keep fixture regressions explicitly separate from real staging evidence. Report any unavailable live check as NOT VERIFIED.

## Public launch remains blocked

- Confirm the legally responsible controller/operator.
- Verify a functioning privacy/correction/deletion/takedown contact.
- Approve a retention/deletion schedule for reports, evidence, accounts, moderation and backups.
- Review complete privacy notice, lawful bases, consent, minors/third-party evidence, moderation/takedown, incident and rights-request handling with a qualified Philippine professional.
- Verify production schema, RLS/grants/RPC authorization, Auth controls, Storage access, upload abuse guards, backups/restore and provider spending safeguards.
- Review CSP enforcement, devices/accessibility, operations ownership and supported notification delivery.
- Remove staging users/keys/config from production artifacts. Production public collection stays paused until explicitly approved; deploying and opening public access each require explicit authorization.

Docker is not installed in this session. A local Supabase stack is an alternative after an authorized Docker-compatible runtime is installed. PGlite SQL tests alone are not a substitute for real Supabase Auth/Storage end-to-end testing.

## Current verification

59 unit tests and 5 isolated PostgreSQL integration tests pass, including tester allowlist/RPC denial and protection against applying staging controls to a populated project. Build, lint and language checks pass. The fixture browser regression suite passes; it remains distinct from real staging verification. The real runner refuses to start with the current production environment. Real Supabase Auth, Storage and workflow persistence remain NOT VERIFIED until a separate backend is available.

No Docker-compatible runtime or WSL installation was found. Local setup requires an authorized system installation and may need administrator approval and a restart. No runtime was installed and no restart was attempted.
