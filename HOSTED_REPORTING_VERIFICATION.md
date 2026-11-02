# Hosted reporting verification — 2 November 2026

This supersedes the production-status statements in `FULL_STACK_RELEASE_RESULT.md`; its isolated test results remain historical evidence. Public reporting remains disabled, as explicitly requested. This is not public-release approval or a billing audit.

## Completed

- Applied the approved anonymous ingress migration to project `xoitncotbgobcsdmvyjb`: remote version `20261102131104`, name `anonymous_reporting_ingress`. Source: `supabase/migrations/20261102110436_anonymous_reporting_ingress.sql`.
- Applied the approved public-read repair: remote version `20261102131105`, name `public_read_contracts`. Source: `supabase/migrations/20261102124056_public_read_contracts.sql`.
- Confirmed the five-argument moderation RPC, service-only ingress grants, private evidence bucket and enabled table RLS. PostgREST schema notifications were included.
- Deployed the compatible, collection-disabled production build `bee64a59943049b234dc893bbf727a4c8d7b08ed`: `dpl_2UuQBXXhAYCQy1LK17BbPxPyQW9e`. Public feed, statistics and progress requests returned HTTP 200. The public submission action remained paused; mobile Waray had no overflow or page errors.
- Configured server credentials as Sensitive variables with separate Production and branch-scoped Preview entries. Their values were never extracted into the workspace or displayed.

## Actual hosted tests

Protected preview `dpl_CCLmXXfiRJHyyfc86bPsaBqTQ7Ec` tested commit `cc9f19375fff2656e961e40b767445a32b20217f` against the intended hosted backend. This was protected testing on the existing backend, not an isolated staging project. Only fictional records and specifically created test identities were used.

- Real Auth password login, private Storage upload/download, optional fictional contact, moderator contact access, and resident denial passed.
- A real browser submitted an anonymous report with a sample photo through `/api/anonymous`, received private tracking credentials, and retrieved persisted status.
- The moderator signed in through the website, viewed private evidence, rejected the submission with priority and separate notes; tracking reflected rejection without exposing internal notes.
- Waray at 390px and moderator desktop at 1440px passed; no browser errors or AI/email function requests occurred.
- Both persisted fictional reports were rejected and excluded from the public feed. They were never approved or distributed publicly.
- Approval, verification, progress, resolution and publication rules were also checked inside a hosted SQL transaction that was fully rolled back. Actual hosted public distribution was deliberately not tested. Full public-browser publication was previously proven in the isolated container stack.

Safe fixture references: run `58a01e7a32c4b8e9`; reports `e8b22487-9f4a-405e-b4ec-f14aab28f3d8` and `8c30efcd-0518-4f85-b9e0-79e98d8381ee`. Fictional private records are retained, not destructively deleted.

Cleanup verified: preview retirement deployment `dpl_EtBVSBoDijkoKX7zYS8K82dGmdKb` is READY with collection flags false. Both fixture roles are resident and both logins are banned, confirmed directly in the database. Temporary share access was revoked; an unauthenticated preview request redirects to Vercel authentication (HTTP 302). Local temporary credentials were removed. Future hosted-proof builds are disabled. Production collection flags were never enabled during testing.

## Activation still requires

1. Final confirmation of the responsible controller and retention decisions, verification that the privacy contact receives requests, and appropriate privacy/legal review. Draft details are not treated as completed approvals.
2. Operational decisions for technical logs, backups, deletion exceptions and request handling. Automatic deletion remains off.
3. Explicit approval to activate public collection. Production and preview collection flags must remain false until then; do not bypass them by removing interface warnings.

Production migration rollback should preserve records: use the reviewed visitor-ingress pause rather than dropping tables or reversing nullable identity support. The previous website deployment is `dpl_DKysWNYdEGF7FD8dcw42uiWA3dMY`; reverting the website does not reverse database migrations.

No plan, billing setting, paid API, AI function or email function was activated. Actual provider charges were not verified.
