# Server-enforced abuse safeguards

Applied to Supabase project `xoitncotbgobcsdmvyjb` on 31 October 2026 (Asia/Manila), using migration `20261030184822_financial_abuse_guards.sql`. The migration is compatible with the inspected legacy production database and the complete local migration chain. It does not apply unrelated pending migrations.

## Active database limits

| Operation | Limit |
| --- | --- |
| Reports per signed-in account | 5 per rolling 10 minutes; 20 per rolling 24 hours |
| Reports across all accounts | 200 per rolling 24 hours |
| Evidence per report | 3 files, including existing objects |
| Evidence per account | 10 new paths per rolling 24 hours; 20 total charged paths |
| Evidence across accounts | 50 new paths per rolling 24 hours; 100 total charged paths |
| Evidence object | Existing private bucket: 5 MiB; JPEG, PNG, WebP |

Report timestamps and ownership are assigned by the database. Identical recent reports are rejected. Transaction advisory locks serialize quota checks and reservations, including across accounts; multi-row inserts are covered. The trigger supplements existing validation/default triggers rather than replacing them.

The restrictive Storage INSERT policy calls a private function that verifies report ownership and a `report UUID/file UUID.jpg|png|webp` path. Limits therefore cover direct Storage API calls, not just browser uploads. Each path is conservatively charged **5 MiB**, irrespective of client metadata: the lifetime limits reserve at most 100 MiB per account and 500 MiB across this bucket. Existing objects count without being rewritten. An additional restrictive policy prevents authenticated overwrites/moves even if a permissive UPDATE policy is added later.

Claims commit or roll back with the Storage database transaction. A repeated preflight check for the same path is idempotent. Claims are deliberately retained after administrative deletion or an abandoned upload: deletion cannot reset an allowance. Storage preflight behavior can therefore consume a slot without a successfully stored file. A trusted administrator must review stale claims and existing objects before reclaiming any capacity; do not blindly clear claims. These are conservative path allowances, not exact provider byte accounting.

Evidence metadata must reference a real object belonging to the reporter and report. Its recorded size and MIME type come from Storage metadata, not the browser. Existing metadata is unchanged. Private quota tables have RLS enabled, no browser table privileges, and intentionally no permissive RLS policies. Trigger-only helpers are no longer directly executable by anonymous or signed-in clients.

## Optional external APIs remain off

No AI or email Edge Function was deployed. Live verification returned an empty deployed-function list. Both rows in `private.external_api_controls` remain `enabled=false`.

The updated local handlers require two independent approvals before calling a provider: an explicit server-side `ENABLE_AI_SCREENING=true` / `ENABLE_EMAIL_NOTIFICATIONS=true` secret and a matching enabled database control. The database allowance RPC is executable only by `service_role`, validates the service/account, and reserves usage atomically. Missing migrations, failed checks, disabled switches, and exhausted allowances fail closed. Existing per-report AI claims and email idempotency remain in place. Failed/uncertain provider attempts still consume their reservations.

If separately approved and deployed later, the maximum attempts are:

| Integration | Per account | Across accounts |
| --- | --- | --- |
| AI | 3 per rolling 24 hours | 20 per rolling 24 hours |
| Email | 10 per rolling hour; 20 per rolling 24 hours | 100 per rolling 24 hours |

These are request counts, not currency limits. AI retains its bounded inputs, 600 output-token request limit, and 15-second provider timeout. Both handlers read no more than 8 KiB of streamed JSON with a five-second body-read deadline. Provider timeouts do not guarantee cancellation of provider billing. AI or email failure does not prevent the report from being saved for human review.

Activation must be explicitly approved separately; it requires reviewing the provider/model, provider spending controls, matching database migrations, server secrets, database control, and function deployment. No activation secrets or billing controls were changed by this work.

## Local build protection

The Vite guard now rejects common OpenAI, Anthropic, Resend, privileged Supabase, GitHub-token, and secret-named client variables before bundling. Intentional Supabase publishable/anon credentials remain allowed. This is defense in depth, not an exhaustive secret detector. The build guard and updated Edge handlers are repository changes; no Vercel/frontend deployment was performed.

## Verification and remaining boundaries

- Isolated PGlite/PostgreSQL tests exercise actual triggers, RLS, legacy object counting, direct API-style inserts, rejected metadata spoofing, overwritten timestamps, quota boundaries, rollback, role permissions, and provider allowances. These tests do not contact production or external providers. PGlite serializes queries; true multi-connection load testing was not performed. The production policies use transaction locks for concurrent requests under the normal READ COMMITTED API isolation level.
- Unit tests mock provider transports and verify default-off gates and rejected allowances. Build and function typechecks are local.
- Read-only production verification confirmed both restrictive policies, both triggers, private-table privileges/RLS, service-role-only allowance access, disabled integration switches, and unchanged counts of one report and three files. No production report, signup, upload, email, or AI test request was sent.
- Supabase's advisor still flags intentionally exposed aggregate/authorized RPCs and private RLS tables with no policies. Those private tables deliberately deny direct access. The existing leaked-password-protection warning remains; no paid feature was enabled. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Public read traffic, bandwidth, signups/recovery emails, compromised administrator/service credentials, unrelated buckets/projects, and provider storage/network behavior remain outside these quotas. Trusted service-role Storage access bypasses RLS. No overall financial cap or billing status is established by this implementation.
- CAPTCHA, provider Auth rate limits, Vercel firewall/spend controls, and provider billing caps require separate account-level review. No paid service, subscription, billing setting, or existing service was activated, upgraded, or disabled.

## Operational changes

Over-limit operations return a database error; existing report and upload error handling continues to work without layout changes. Global limits can be exhausted by many abusive accounts, temporarily preventing legitimate submissions; existing content stays readable. Review usage before adjusting constants through a reviewed migration. Financial exposure cannot be eliminated by application quotas alone.

If a regression requires rollback, review a narrow follow-up migration removing only the two new Storage policies and two new triggers; retain the private ledgers for investigation. Do not roll back unrelated historical migrations, delete user files, regrant public trigger-helper execution, or enable external integrations as a recovery step.
