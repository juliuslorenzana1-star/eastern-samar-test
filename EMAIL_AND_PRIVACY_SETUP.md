# Email and volunteer privacy setup

Implementation is local. No migration, function deployment, SMTP configuration, or live email test has been performed.

## Approval required before database changes

Review `supabase/proposed/202610140001_participation_privacy_and_email.sql`. It is intentionally outside the automatic migrations directory. After approval, review the deployed schema against existing migrations, back up the database, promote this file into migrations, and apply using your normal Supabase workflow.

The draft adds a separate public alias, narrows public leaderboard output to opted-in aliases, counts completed activities separately from recorded attendance, blocks staff from crediting themselves, and adds a server-only notification ledger and atomic reservation RPC. Existing service records remain intact; people without an alias are omitted until they choose one. The existing unique opportunity/volunteer constraint prevents duplicate activity credit. Existing role-change protection and profile policies must be validated on the deployed database before enabling this feature.

The email function deliberately refuses to send if the ledger RPC is missing. Alias opt-in controls remain unavailable until the alias column exists; existing participants can still turn visibility off.

## Server secrets

Configure in Supabase Edge Function secrets, never in Vite variables:

| Name | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Sending credential for Resend |
| `EMAIL_FROM_ADDRESS` | Sender on your verified domain |
| `APP_URL` | Canonical HTTPS app URL, including any base path |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase server runtime values; service role stays server-side |

Verify the sending domain in Resend and publish its required SPF/DKIM records. Deploy `send-email-notification` only after the database draft has been approved and applied and secrets are configured. Keep JWT verification enabled. The function also validates the bearer token, checks record ownership under the caller's RLS context, and reads all email content from stored records. It never accepts a recipient from browser input.

## Account verification

Supabase Auth remains the verification authority. Enable email confirmations and configure Resend through Supabase custom SMTP or the supported Resend integration. Configure sender, SMTP credentials, Site URL, and allowed redirect URLs (including localhost during development) in the dashboard. Do not put SMTP credentials in frontend files or mark accounts verified from email API responses.

Official references: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend and Supabase](https://resend.com/supabase), [Resend idempotency](https://resend.com/changelog/idempotency-keys).

## Notification states and retry behavior

The server reserves one notification per report or volunteer registration, with a limit of ten new reservations per account per hour. It also supplies a stable Resend idempotency key. Resend retains those keys for 24 hours; the database reservation persists beyond that period.

`accepted` means Resend accepted the request, not delivery to an inbox. `failed`, `uncertain`, and `reserved` remain reserved to prevent duplicate sends. Automatic retries do not resend. This favors duplicate prevention over guaranteed eventual delivery. Investigate provider records before any manual retry; do not delete a reservation blindly. Rejoining the same activity keeps the existing registration reference and does not send a second confirmation.

The ledger stores status and provider ID, without email addresses or message bodies. A signed, verified provider-webhook integration would be required to track delivered/bounced states; it is not implemented. Report and volunteer success remain valid if email fails. Frontend messages direct residents to My submissions or My Activities.

Email links use `#submission=<uuid>` and `#volunteer=<uuid>`. Private report links require sign-in and resolve only against the signed-in user's own submissions. The welcome toast runs after explicit successful password sign-in and uses the profile's first name, with a neutral fallback.

## Validation

Run `node --test supabase/functions/send-email-notification/index.test.mjs` using Node 24 for mocked endpoint tests. These exercise the actual TypeScript handler with mocked Supabase and Resend requests; they do not verify live SQL/RLS or delivery.

Before production, validate two resident accounts and a moderator: alias opt-in/off, anonymous public output, own versus another resident's private report, blocked self-verification, staff verification of another volunteer, repeated credit updates, and concurrent duplicate email requests. Test missing secrets, rate limits, provider timeouts, SMTP confirmation links, email deep links after login, and mobile/reduced-motion behavior. Deno type checking and live browser QA remain outstanding in this environment.
