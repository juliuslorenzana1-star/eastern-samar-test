# Presentation readiness audit — 1 November 2026

Scope: the current, uncommitted React/Vite application, SQL migrations and proposed repair, Edge handlers, deployment configuration, tests and existing operational documentation. No production writes or deployment are authorized by this task. This is a targeted review using OWASP ASVS 5.0 as a baseline, not an ASVS certification or exhaustive penetration test.

## Priorities before implementation

| Severity | Finding | Evidence / action |
|---|---|---|
| HIGH | Live authenticated integration remains unqualified | DEPLOYMENT_READINESS.md documents legacy schema/migration divergence. Isolated SQL/browser success cannot establish live Auth, Storage or moderation correctness. Rehearse the reviewed repair on staging; never push historical migrations blindly. |
| HIGH | No approved privacy contact, retention schedule or operational deletion procedure | No complete public privacy/terms mechanism found in the current UI. Prepare truthful draft notices and an operator decision checklist. Do not invent an address, claim legal compliance or promise automated deletion. |
| MEDIUM | Optional AI/email calls attempted by ordinary actions | src/lib/reports.js and volunteers.js invoke absent functions. Add explicit opt-in frontend gates, retain authoritative server controls, and test that default workflows make no optional calls. |
| MEDIUM | No CSP | vercel.json has nosniff, referrer and frame headers only. Stage a restrictive CSP in Report-Only first to avoid silently breaking Leaflet, storage images or Auth; document promotion acceptance. |
| MEDIUM | No isolated presentation mode | Existing tests intercept requests but are not an interactive presentation entry. Build a separate localhost rehearsal with fictional records, persistent demo label and network interception; never ship fake staff access in production. |
| MEDIUM | Presentation interface differs from deployed release | Language/design changes exist locally. Record the local build with a conspicuous rehearsal label; do not claim the footage matches production until an approved deployment and comparison. |
| MEDIUM | Backup/restore evidence absent | Local source snapshot is not a database backup. Require operator-owned database + Storage backup and rehearsal before any future schema rollout. |
| LOW | Native language review outstanding | LANGUAGE_MODE.md identifies Boronganon terms for native-speaker review. Preserve user prose and database enums. |
| LOW | CSS layering and sibling projects complicate maintenance | Multiple global CSS layers and unrelated project-hiram/zlt-diagnostics exist. Preserve them; avoid risky consolidation before the presentation. |

## Existing strengths and limits

- Server SQL contains report submission quotas, owner checks, restricted evidence paths, conservative upload allowances, no overwrites, moderation audit history and role checks. Existing isolated database tests exercise RLS/ownership and quota rejection. Live deployment equivalence is not asserted by source inspection.
- Private evidence is signed for five minutes; uploads accept JPEG/PNG/WebP up to 5 MiB. Client magic-byte checks are UX validation, not server-side malware scanning or EXIF removal. Avoid photos identifying people; server re-encoding remains a future reviewed improvement.
- Public queries request explicit columns and published statuses; resident history uses auth.uid()-filtered RPC with an ownership-filtered legacy fallback. UI role checks are not the authorization boundary.
- No dangerouslySetInnerHTML found in application source. React escapes resident text. Leaflet HTML attribution is static source-owned content, not report prose.
- Build credential guard rejects common privileged VITE credentials. Public Supabase publishable/anon keys are expected; their safety depends on grants and RLS. No credentials are reproduced in this report.
- 1 November registry audit: 0 known dependency vulnerabilities. This is advisory coverage at a point in time, not a security guarantee.
- Source/build audit does not establish provider charges, payment methods or a maximum bill. Billing remains NOT VERIFIED in this task.

## ASVS 5.0 review map

| Area | Evidence | Remaining verification |
|---|---|---|
| Encoding, validation, file handling | React text rendering, report validator, file signature/size checks, Storage policy | Real Storage MIME behavior, image metadata handling |
| Authentication and sessions | Supabase SDK, restored sessions, local auth fixtures | Staging confirmation, recovery, revoked/expired session behavior |
| Authorization | SQL RLS, role guards, controlled SQL denial tests | Compare live grants/functions and independent resident/staff staging sessions |
| Web frontend and configuration | Env guard, pinned lockfile, security headers | Enforced CSP acceptance after report-only observation; real-device testing |
| API/resource protection | Database quota locks, default-off provider controls | Cross-session staging races and operational quota exhaustion recovery |
| Data protection and logging | Private evidence, explicit public columns, audit functions | Privacy ownership, retention/deletion, backup restoration |

Baseline: https://asvs.owasp.org/ (ASVS 5.0.0). Philippine legal review reference: https://privacy.gov.ph/data-privacy-act/ . Obtain qualified Philippine privacy/legal review; the presence of a notice alone does not establish compliance.

## Rollback point

Before implementation: HEAD plus a binary tracked patch and copies of untracked root-project work were saved to `C:\Users\Joselito\AppData\Local\Temp\escam-readiness-20261101-154547`. Unrelated sibling-project untracked files were left untouched. This snapshot may contain local source and must remain private. Restore into a separate checkout first; do not reset this working tree. No database rollback is needed for this task because it makes no database changes.
