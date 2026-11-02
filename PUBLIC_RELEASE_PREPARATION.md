# Public reporting preparation — 2 November 2026

Internal working document. Not a published privacy notice, approved retention policy, or legal compliance determination. Public collection is not authorized by this document.

## Owner proposals received — 2 November 2026

Proposed controller: Julius Yexel A. Lorenzana, conditional on actual responsibility. Designated contact: juliuslorenzana1@gmail.com, not yet delivery-tested. Proposed periods: reports/photos two years after closure, moderation three years after closure, accounts while active and a 30-day verified-deletion handling target. See `PRIVACY_POLICY_DRAFT.md` for the full proposal and unresolved categories. These proposals supersede the earlier absence of details below; final confirmation, contact verification and review remain necessary.

Anonymous no-registration reporting has now been implemented locally with secure ingress and tracking. It is not deployed or approved for activation; see ANONYMOUS_REPORTING_IMPLEMENTATION.md. Existing account-linked submissions are not relabeled anonymous.

## Original decision checklist and remaining verification

- Confirm who is legally responsible for operating the platform. The provisional designation supplied earlier is “Julius Lorenzana — Independent Project Developer”; it remains unconfirmed.
- Verify receipt and reply at the owner-designated contact using a non-personal test message. No delivery test has occurred.
- Finalize the proposed retention rules and unresolved categories below. No deletion schedule has been activated.

| Category | Decision to approve | Deletion dependencies to review |
| --- | --- | --- |
| Reports and location | Retention trigger, duration, and whether an anonymized public record remains | Public map, report details, search and exports |
| Uploaded evidence | Duration for pending, approved and rejected evidence | Private objects, signed links, metadata, orphaned uploads |
| Accounts and profiles | Inactivity and closure rules | Auth identity, aliases, report ownership and registrations |
| Moderation and audit records | Accountability period and permitted access | Internal notes, resident feedback and audit events |
| Volunteer records | Period after an activity or withdrawal | Attendance, registration and account links |
| Backups, logs and disputes | Backup expiry, documented holds and eventual deletion | Restores must not silently reinstate deleted public data |

For each row, approve a purpose, start event, duration, deletion or anonymization action, responsible person and exception process. These decisions must precede implementation of automated deletion.

## Privacy notice drafting specification

Prepare the final notice only after the decisions above are confirmed. It must accurately describe the operator and contact; information actually collected; purposes and applicable lawful basis; public versus private fields; evidence handling; hosting and other recipients; transfer arrangements; retention; access, correction, deletion and takedown procedures; complaints; and revision date. Do not imply government affiliation, guaranteed resolution or legal compliance.

Keep optional public identity separate from information required to process a report. Warn users against uploading IDs, faces, contact details, sensitive information or identifiable third-party information unnecessarily. Review handling of minors and sensitive reports before release. Do not treat a blanket consent checkbox as permission for all processing.

## Rights-request operating procedure draft

1. Receive the request through the verified contact and restrict access to the request record.
2. Confirm receipt and determine the relevant report or account. Seek only the minimum identity evidence necessary; do not routinely request identity-document uploads.
3. For exposed sensitive information, review temporary unpublication promptly under the approved moderation authority.
4. Assess correction, removal, deletion and any documented retention exception; obtain qualified advice where required.
5. Apply the approved decision to database records, storage objects and public views, preserving only justified restricted records.
6. Verify the public result, record the action and communicate the outcome. Track backup expiry and restore handling under the approved schedule.

Response deadlines and exceptions require review; none are invented here. No email service or automation is activated.

## Technical release sequence

- Keep the existing collection gate and RLS intact. Do not use staging flags or fictional transport to enable production writes.
- Review current provider settings and grants again before release. Earlier findings showed open Auth signup and direct authenticated report inserts: a frontend pause alone is not a provider-side restriction.
- Obtain a genuinely isolated writable test environment; the earlier free project creation failed at the project limit. Existing applications must not be repurposed without approval.
- Verify real Auth, private Storage, authenticated submission, server upload quotas, report rate limits, ownership, moderator authorization, publication rules, notification tracking and volunteer registration. Use non-personal test data and verify resident/anonymous denial of moderator actions.
- Review the proposed read RPC repairs and any production migration separately. SQL in `supabase/proposed` is not automatically applied. Preserve internal-note privacy and truthful verification timestamps.
- Finalize the proposed retention policy and verify deletion, storage cleanup and restore handling in isolation before activating any future schedule. No automatic deletion is authorized or enabled.
- Publish the complete approved notice and appropriate collection disclosures in all supported languages. Do not publish this internal draft or unfinished notice text as the public policy.
- Prepare a reviewed production enablement change with an explicit release decision; the current collection policy intentionally allows only isolated test writes.
- Request explicit deployment and activation approval for the exact tested changes. Main branch publication does not authorize deployment. Deployment guards currently keep Git pushes separate from releases.
- After approval, deploy and verify the authorized release using isolated test records, with rollback ready. Keep AI and email generation disabled unless separately approved; do not activate paid services or change billing settings.

## Current completion boundary

Run the non-destructive retention example with:

```sh
node scripts/retention-preview.mjs scripts/retention-example.json --metadata-only
```

The tool accepts only metadata fields, has no provider client or credentials, emits proposed review actions and always sets `executable: false`. It does not replace database lifecycle fields, Storage cleanup, Auth deletion, audit redaction, backup expiry or a reviewed deletion worker. The supplied schedule remains a proposal subject to final review.

The public availability wording has been corrected locally so it no longer claims a separate restricted test environment exists. The supplied contact and conditional operator/retention proposals are recorded above. A local metadata-only retention preview implements the proposed anniversary and account-request calculations without connecting to providers or deleting data. No production activation, migration, provider change or deployment has occurred in this preparation task. Hosted end-to-end testing remains blocked by the unavailable isolated backend. Existing local tests do not establish public production readiness.
