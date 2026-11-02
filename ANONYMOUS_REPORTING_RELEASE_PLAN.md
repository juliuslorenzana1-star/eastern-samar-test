# Anonymous reporting implementation and verification gates

Owner requirement recorded 2 November 2026. **Implemented locally, not deployed or enabled publicly.** See ANONYMOUS_REPORTING_IMPLEMENTATION.md for the delivered code, tests and remaining gates. This document identifies the specific blockers rather than relabeling account-based reporting as anonymous.

## Original incompatibilities (addressed by the local implementation)

- `src/App.jsx:startReport` redirects signed-out people to Auth.
- `src/lib/reports.js:createReport` requires a user ID; direct report insertion and storage ownership assume that identity.
- The initial `reports.reporter_id` foreign key is non-null. `set_report_defaults_and_location_precision` rejects a null Auth identity and overwrites reporter_id.
- Existing report/evidence/private-location policies, profile ownership, offline drafts, receipts and My submissions depend on a reporter identity.
- Legacy authenticated column grants include reporter_id for compatibility. Even an opaque account UUID is an identifier; a reviewed public projection must exclude it along with all private contact fields.

## Required implementation boundaries

1. Introduce an independently reviewed visitor submission ingress. Do not grant unrestricted anonymous direct table or bucket writes. No synthetic shared account and no hidden Auth registration.
2. Authenticate the ingress to a narrowly authorized database operation. Review any privileged function's owner, fixed search path, validation, execution grants and inability to set publication/reviewer fields. Keep RLS enabled. Never expose a service credential in frontend code.
3. Default to anonymous and collect no name, email or phone. Optional confidential identification requires a deliberate selection; keep optional contact data in restricted storage separate from public report projections. Switching back to anonymous must clear and omit those fields.
4. Apply transactional global and source-level submission/upload quotas, bounded request and file sizes, durable duplicate handling and abuse controls. Source identifiers must come from a trusted platform boundary, not a visitor-supplied header; assess shared networks and log minimization. Quotas must also cover failed uploads and orphaned storage. No AI/email calls from the new path.
5. Keep submissions private and pending human review. Reuse the reviewed moderation RPC and lifecycle; do not grant visitors moderation, status or publication control. Evaluate report text and approximate locations for identifying information before publication.
6. Use a high-entropy private receipt secret for private status access if provided, with a server-side hash, bounded lookups and no secrets in URLs, analytics or logs. A UUID alone must not authorize access. Decide recovery/deletion verification without requiring an identity document or account by default.
7. Adapt private evidence access, safe upload validation, review tools, receipts, draft ownership and status tracking to the new ownership model. Explicitly label shared-device risks. Do not imply anonymous visitors can use account-only tracking before implementation.
8. Add authoritative closure/history and retention dependency handling before destructive jobs. Reopening cannot erase closure history; identify which closure controls expiry. Review notes/audit JSON and backups for residual personal information.

## Required isolated tests before release

- Signed-out person submits a real persisted report without creating an Auth user or profile.
- Identity/contact fields are optional and never returned in public REST/RPC payloads, map markers, exports, logs or errors; authenticated non-owners cannot read them either.
- Pending/rejected reports are absent from public reads. Moderator approval persists and publication contains only the reviewed projection.
- Anonymous callers cannot modify priority/status, impersonate staff, assign another reporter, enumerate private receipts or read private evidence.
- Concurrent requests cannot evade source/global/report/byte quotas. Spoofed headers, repeat requests and invalid/oversize images fail safely.
- Upload failure and retries do not create unlimited objects or duplicate reports; successful report persistence is not reported as total failure after an optional step fails.
- Existing account-linked reporting, moderation, volunteer registration, translations, mobile layout and tracking remain functional.
- Contact receipt/reply verification, final policy approval and deletion/restore procedures are documented.

## External blocker and deployment boundary

There is no verified isolated writable Supabase backend available. The prior free staging creation hit the project limit; existing projects are applications and cannot be repurposed without authorization. Local database tests can validate migrations but cannot establish hosted Auth/Storage behavior. Do not change production schema/data as a substitute for isolated testing. No migration, endpoint deployment, new paid service or public activation is authorized merely by drafting this plan.
