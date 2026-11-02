# Eastern Samar Community Action Map — privacy policy working draft

**Internal review only — not the published notice. Updated 2 November 2026.**

This draft records owner-supplied proposals. It does not certify legal compliance, activate public collection, or state that the proposed anonymous workflow already exists.

## Operator and contact

Proposed individual operator and personal information controller: **Julius Yexel A. Lorenzana**, subject to confirmation that this person determines the purposes and means of processing. This is an independent civic engagement platform, not an official government platform or an authorized organizational service.

Owner-designated privacy contact: **juliuslorenzana1@gmail.com**, for privacy concerns, correction, deletion and report takedown requests. Delivery, monitoring and reply capability have not yet been independently verified. Do not send identity documents or sensitive evidence in an initial request unless a justified secure process has been agreed.

## Intended reporting choices

Anonymous reporting must be the default, without account registration or required name, email or phone. Confidential identified reporting is an optional alternative. Reporter identity and contact details must never be included in public report responses, map payloads, exports, notifications or public recognition. All submissions require authorized human moderation before publication.

Anonymous does not mean technically untraceable: hosting, security and network systems may process IP addresses, request metadata and other potentially identifying logs. Do not promise that these logs do not exist. Inventory actual providers, log access and retention before finalizing the public notice.

Implementation status: account-free visitor submission, optional confidential contact, private tracking and moderation integration are implemented and tested locally. They are not deployed or activated. Hosted Supabase Auth/Storage rehearsal remains blocked by the unavailable staging project. No hidden Auth registration is used; see ANONYMOUS_REPORTING_IMPLEMENTATION.md.

## Purposes and visibility

Proposed purposes are receiving community concerns, confidential review, publication of moderated non-identifying concern information, progress tracking, coordinating separately requested volunteer participation, preventing abuse and responding to rights requests. Determine and document the applicable lawful basis for each purpose before release. Do not assume blanket consent covers sensitive or third-party information.

Collect only information necessary for the concern. Avoid names, allegations identifying individuals, contact details, identity documents, victims or vulnerable people in report text or photos. Exact map locations, evidence and internal moderation notes remain restricted. Approximate public coordinates can still identify a household: moderation must assess that risk before publication. A public title or description must be checked and redacted where necessary.

Existing accounts, volunteer registration and optional public aliases are separate processing activities; optional identity reporting must not automatically enroll people in them. Offline drafts currently persist on the local device until managed by the user; backend deletion alone cannot erase copies stored on that device.

## Proposed retention schedule

| Data | Owner-supplied proposal |
| --- | --- |
| Citizen reports | Two years after resolution or closure, then delete or anonymize personal information. Non-identifying historical statistics may remain. |
| Uploaded photos | Up to two years after report closure; delete earlier where privacy or safety requires it. |
| User accounts | While active. Target processing verified deletion requests within 30 days, except justified lawful retention. |
| Moderation records | Three years after case closure, subject to applicable legal requirements. |

The 30-day account target is a proposed operational target, not a legal deadline or a guarantee that every associated record is deleted. The proposal does not authorize retaining everything for 30 days when earlier action is appropriate.

Still unresolved: open or abandoned reports, withdrawn reports and appeals; reopening and authoritative closure timestamps; volunteer records; optional private contacts; technical logs and abuse counters; backup expiry and restore suppression; legal holds; audit copies containing report text; and the exact deletion/anonymization method. Do not substitute last-updated timestamps for closure. Operationally verify holds and dependency cleanup before any deletion.

## Rights and handling

Use the designated address to request access, correction, deletion or takedown. Identify the relevant report with the least information necessary. Request only proportionate verification, especially for an anonymous reporter who has no account. The platform needs a private receipt/recovery mechanism that does not expose pending reports to anyone who guesses an ID. Staff must record their decision, secure private evidence, review urgent privacy risks and explain any justified retention exception.

## Provider and operational review

The repository uses Vercel, Supabase and GitHub. Confirm actual hosting regions, subprocessors, log collection, access, international transfers and operational recipients against the deployed environment before making public statements. No AI or automated email processing is authorized by this policy proposal. There is no assurance that optional integrations are running or that provider charges are zero.

Review minors, sensitive information, complaint handling, incident response, staff access and applicable registrations or responsibilities with qualified Philippine privacy/legal advice. Reference: [National Privacy Commission — Data Privacy Act](https://privacy.gov.ph/data-privacy-act/). This draft makes no legal conclusion.

## Publication gate

Do not publish this draft as a completed policy. Obtain final operator confirmation, functioning-contact verification, legal/purpose review, retention approval and an implemented/tested anonymous reporting path. Complete isolated database/Auth/Storage tests and privacy leakage checks. Obtain separate approval for the exact deployment and public activation.
