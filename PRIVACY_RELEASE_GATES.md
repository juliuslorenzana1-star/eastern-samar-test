# Privacy decision record — 1 November 2026

**2 November testing update:** the full Supabase Docker proof now passes on a standard public GitHub runner, including real Auth, Storage, moderation and browser publication. A second hosted project is no longer required for this integration proof. See [FULL_STACK_RELEASE_RESULT.md](FULL_STACK_RELEASE_RESULT.md). Controller/contact/final policy decisions and authorized production-specific checks remain separate; none is marked completed by these tests.

**Public release blocked. Restricted fictional demonstration only.**

Internal provisional designation, supplied by the developer: **Julius Lorenzana — Independent Project Developer**. This is not confirmation of the legally responsible personal information controller, an organization, or a government affiliation.

No incomplete privacy notice or placeholder contact is published by this work. The application already contains limited reporting/privacy guidance; that guidance does not replace a complete notice or an operational rights-request process.

## Updated owner proposals — 2 November 2026

The owner has proposed **Julius Yexel A. Lorenzana** as individual operator/controller, conditional on accurately reflecting responsibility. This supersedes the older provisional name above for drafting, but is not unconditional confirmation. The designated privacy contact is **juliuslorenzana1@gmail.com**; receipt, monitoring and reply capability still need verification. Do not send an email on the owner's behalf without authorization.

Proposed retention: reports two years after resolution/closure, photos up to two years after closure with earlier safety/privacy removal, accounts while active with a target of 30 days for verified deletion requests, moderation records three years after closure. These are subject to final review, not activated deletion rules. Backups, logs, volunteer data, contacts, unresolved reports and hold handling still need decisions.

The owner additionally requires no-registration anonymous reporting by default and optional confidential identified reporting, with no public reporter identity/contact disclosure. These original blockers are now addressed by a locally tested anonymous ingress migration and browser workflow; neither is deployed or activated. See ANONYMOUS_REPORTING_IMPLEMENTATION.md. Do not solve this by opening anonymous table/storage INSERT access or fabricating a shared reporter account.

See [the internal policy draft](PRIVACY_POLICY_DRAFT.md) and [public release preparation](PUBLIC_RELEASE_PREPARATION.md). No incomplete public notice is published. The contact link alone is not the complete notice.

Before public collection can resume, the owner must approve and verify:

1. A functioning contact address for privacy, correction, deletion and takedown requests, including a real end-to-end receipt/reply test.
2. The legally responsible platform operator/personal information controller and applicable responsibilities.
3. A retention/deletion schedule covering reports, uploaded evidence, accounts and moderation records, including backups, disputes, legal holds and deletion verification.

Do not invent any of these, make compliance claims or enable collection solely for the presentation deadline.

## Implemented locally

The default build fails closed for account form requests, report creation, volunteer registration and public alias updates. It displays a compact expandable availability disclosure; blocked public account/report entry asks for no personal-data fields. The isolated browser rehearsal uses `https://demo.invalid` and fictional identities, with every external request intercepted or blocked. Optional AI and email calls default off independently.

The client gate is an operational safeguard, **not server authorization**. A public browser can bypass client code. Existing deployed code and direct provider endpoints are unchanged. Collection has **not** been verified disabled on production by this task.

`VITE_ENABLE_PERSONAL_DATA_COLLECTION=true` now requires an explicitly identified separate staging backend (or an isolated fixture harness). Public activation now has a separately reviewed code path requiring explicit release approval and the exact intended project reference; ordinary staging flags cannot enable collection against existing application projects. Do not set it on a public deployment until all gates and backend restrictions have been reviewed. No such provider environment setting was changed here.

## Production restriction plan — requires separate explicit authorization

- Inventory current RPC definitions/grants first. Authenticated mutation RPCs that run as SECURITY DEFINER can bypass RLS; revoke browser execution on exact submission/join/profile mutation signatures during the pause. Preserve original grants for reviewed restoration.
- Stage restrictive INSERT/UPDATE policies for personal-data tables, without removing ownership, moderation or quota policies. `supabase/proposed/pause_public_collection.sql` is an incomplete review aid, **not an executable complete pause**; it intentionally requires the live RPC inventory. Do not apply it alone and claim collection is off.
- In Supabase Auth, disable new user signups and review email/phone/external sign-in and recovery flows for collection during the pause. Exact supported settings must be checked in the current dashboard; do not disable existing services or alter production settings without the owner's authorization.
- Deploy the reviewed read-only frontend only after explicit deployment approval. Restrict access to the demonstration environment; do not distribute a public collection-enabled QA build.
- Verify direct requests, not only UI buttons: report/evidence/location writes, signup/profile changes and volunteer registration must fail for ordinary accounts. Avoid production test personal information; use a staging copy first.
- Once controller/contact/schedule and legal review are approved, prepare complete, accurate notices and terms. Restore only the original reviewed grants and pause policies; keep server quotas and private evidence protection intact.

## Professional review questions

Use a qualified Philippine privacy/legal professional to review lawful bases, sensitive and third-party data in reports/photos, minors, recipients and processors, international transfers, rights handling, moderation/takedown fairness, security incident handling and retention. The Data Privacy Act is available from the [National Privacy Commission](https://privacy.gov.ph/data-privacy-act/). No legal compliance conclusion is made here.

## Presentation language

“This is a restricted demonstration using fictional information. Public personal-information collection is a release blocker pending verified contact, controller confirmation and an approved retention/deletion schedule.” Do not state that production collection is disabled until the provider and direct-request checks above are complete.

## Latest read-only readiness findings

Supabase Auth still reports `disable_signup=false`, and authenticated report INSERT privileges remain active behind existing ownership/quota policies. The frontend gate is therefore not a verified provider-side collection pause. No production settings or SQL writes were changed in this readiness task. The reviewed, locally tested trigger pause proposal now covers direct and privileged-RPC inserts; separate Auth signup closure and release approval are still required. See [the full readiness report](FINAL_READINESS_REVIEW.md).
