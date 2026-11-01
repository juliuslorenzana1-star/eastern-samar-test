# Presentation readiness verification — 1 November 2026

**Disposition: ready for a restricted, fictional local rehearsal; NOT approved for public collection or deployment.** The presentation deadline is 7 November 2026. No deployment, database alteration, production test write, paid service activation, billing change, or AI/email function deployment was performed in this task.

## 1. Changes implemented

- Added a prioritized [non-destructive audit](PRESENTATION_READINESS_AUDIT.md), ASVS 5.0 review map and source/build inventory. The review covers this root application; unrelated `project-hiram` and `zlt-diagnostics` work remains untouched.
- Preserved existing homepage, maps, report steps, volunteer portal, staff interface, responsive layout and language mode. Documented the **Estehanon Civic Interface** in [the design system](ESTEHANON_CIVIC_INTERFACE.md).
- Added explicit default-off client gates for optional email and AI calls. Existing authoritative server quotas remain necessary; these client flags do not grant or enforce backend authorization.
- Implemented the owner's privacy instruction: the default local release build pauses account form requests, report creation, volunteer joining and public alias updates, with a translated visible notice. No placeholder privacy policy, invented contact, controller affiliation or retention period was published.
- Added proposed Permissions-Policy and CSP Report-Only headers in `vercel.json`. Moved theme initialization into a self-hosted script so it works without inline script permission. These settings are local and not deployed. CSP remains monitoring-only, with no reporting endpoint; it is not an enforced XSS defense yet.
- Added isolated interactive rehearsal (`npm.cmd run demo:presentation`) and seven-scene automation. Fictional accounts, concern, evidence graphic, verification timeline and volunteer activity live only in memory. All nonlocal network requests are intercepted or blocked; no production statistics are changed. Demo role selection is test harness behavior, not production staff authorization.
- Rendered the 2:30 local rehearsal, offline narration, English SRT and embedded subtitle track, silent backup, source WebMs, shot previews and original title card. See [the production package](VIDEO_PRODUCTION_PACKAGE.md).

## 2. Bugs and root causes

| Issue | Cause | Fix / evidence |
|---|---|---|
| Optional function traffic on normal actions | Frontend invoked undeployed email/AI handlers unconditionally | Require explicit opt-in; tests prove disabled email makes no transport call and reporting succeeds without optional calls |
| CSP incompatibility of initial theme | Inline theme script | Self-hosted `public/theme-init.js`; built HTML has no inline script |
| Unnamed volunteer map marker | No title/accessible name on Leaflet icon | Original activity title supplies title and aria-label; preserves keyboard activation and translation behavior |
| Decorative pin could become keyboard target | Leaflet keyboard default remained true for noninteractive marker | Disable keyboard only on noninteractive markers; retain it for interactive markers |
| Low contrast in pause, errors and muted form/list copy | Existing muted colors on light surfaces; new banner inherited an unsuitable variable | Targeted light/dark colors; automated checks now pass at 320/768/1440 in both themes |

Rehearsal harness development also exposed an out-of-extent test click, a hidden mobile-nav locator on desktop, opaque-origin localStorage access and a hash-only navigation that did not reload a synthetic session. These were harness errors, corrected and rerun; they are not claimed as production bugs. Narration overflow in the final scene was corrected by a modest offline voice rate increase; no words were clipped. Windows FFmpeg concat paths were corrected before successful assembly.

## 3. Verification results

| Check | Result and scope |
|---|---|
| Production build | PASS; latest default `dist` has collection paused |
| Lint | PASS; one pre-existing unused import warning in unrelated `project-hiram/tests/inventory-photos.test.mjs`; no new owned warnings |
| Unit/handler tests | 58 PASS, 0 failed, including optional-call and collection-pause tests |
| Isolated database integration | 4 PASS: SQL policies/roles, quotas, capacity, privacy, legacy repair and recognition; no production writes |
| Function type checks | PASS for both existing Edge handlers; no function deployed |
| Language audit | PASS: 1,161 keys in all three catalogs; zero missing translations/static JSX labels in the audit scope |
| Existing browser regression suites | PASS: 57 logged scenarios across redesign, interface, onboarding and mobile recognition; responsive widths 320–1920 and light/dark |
| Language browser suite | PASS: 8 groups covering four responsive widths, persistence, account/report/volunteer/moderator state and original-content preservation |
| Seven-scene rehearsal | PASS during recorded run: private submission/evidence, no pre-review public visibility, verification, public timeline, volunteer joining and language switching |
| Default-build privacy/browser checks | PASS: 320/768/1440 × light/dark; account and report actions blocked before mutation traffic; no horizontal overflow or uncaught page errors |
| Automated accessibility | axe-core 4.14.0: zero WCAG 2 A/AA violations in the tested paused-report state across those six viewport/theme combinations. This is not a whole-site accessibility certification |
| Source/build security checks | PASS: 150 relevant files inventoried; no matching privileged-key patterns; no built JS source maps or inline scripts. Pattern scanning is not proof that every possible credential format is absent; git history was not rescanned in this task |
| Dependency advisories | npm registry audit: 0 known vulnerabilities at time of check |
| Rendered media | PASS full FFmpeg decode; H.264 High/yuv420p, 1920×1080, 30 fps; AAC 48 kHz stereo; English mov_text subtitle track; container reports 2:30.02 including audio packet rounding |

The full browser regression used a separate collection-enabled **local QA build**, with provider requests intercepted by existing fixtures. The ordinary release `dist` was rebuilt with collection disabled and independently verified. No collection-enabled QA artifact was deployed. Later marker/color fixes were checked by the focused privacy/accessibility suite; they did not require repeating unaffected backend tests.

Evidence: ignored `test-results.local/readiness/` contains build/browser logs, privacy/accessibility JSON and screenshots, and a SHA-256 source inventory. Existing suite outputs remain under `test-results.local/`. Media and edit manifest are under `presentation-output.local/`.

## 4. Remaining vulnerabilities and operational risks

- **HIGH / release blocker:** production personal-data collection has NOT been disabled or verified disabled by local changes. A client gate cannot stop direct Auth/REST/RPC/Storage requests. A separately authorized provider/frontend restriction is required. The proposed SQL is explicitly incomplete until live SECURITY DEFINER mutation signatures/grants are inventoried; do not run it alone and claim a full pause.
- **HIGH / release blocker:** live authenticated integration/schema equivalence is still unqualified. Older operational documents flag a legacy repair gap. Rehearse the actual live shape in staging; never apply historical migrations blindly.
- **MEDIUM:** CSP is Report-Only; validate Auth, signed images, map providers and permitted origins before enforcing it. No central violation collection is configured.
- **MEDIUM:** provider signup abuse controls, rate limits, CAPTCHA, recovery mail, token revocation and cross-session capacity races need staging/provider verification. Browser fixtures cannot prove them.
- **MEDIUM:** Storage MIME/size/path/quota policies do not constitute server-side malware scanning or image re-encoding. EXIF/location metadata handling needs review before accepting real evidence.
- **MEDIUM:** bandwidth/egress and platform billing hard caps are not verified. Database quotas reduce certain write/storage risks, not all infrastructure exposure. Actual charges and maximum financial exposure remain NOT VERIFIED/undetermined; no billing conclusion is inferred from code.
- **LOW / acceptance:** physical iOS/Android, WebKit, screen-reader use, complete accessibility coverage and native Boronganon review remain outstanding.

## 5. Legal and privacy concerns

The owner requires a verified working contact, a confirmed responsible controller/operator, and an approved retention/deletion schedule for reports, evidence, accounts and moderation records. All remain explicit public-release blockers. The internal designation is provisional only: **Julius Lorenzana — Independent Project Developer**. No organizational/government affiliation or legal compliance is claimed. [Privacy gates](PRIVACY_RELEASE_GATES.md) detail professional Philippine legal review questions and the production restriction plan. Restricted demonstrations must use fictional data only.

## 6. Performance observations

Latest Vite output: initial JS chunk about 345 KB / 102 KB gzip; main CSS about 186 KB / 38 KB gzip. Optional language chunks load on demand at about 26 KB gzip each. Staff and volunteer views remain split chunks; geographic data remains a substantial asset. No Lighthouse, real-device network budget, production latency or load-test result is claimed. Do not add paid caching/observability solely for the presentation. Offline rehearsal blocks external tiles/fonts and truthfully demonstrates map fallback; use the geographic title graphic rather than pretending street tiles were loaded.

## 7. Deployment and video readiness

**Do not deploy automatically.** No public collection release is approved. Production matching, privacy/operator decisions, provider restrictions, staging integration and backup restoration remain gates. No live API test traffic was generated.

The rendered video is a **local rehearsal**, not a certified final launch film: synthetic narration is an offline draft, sentence-level subtitle timing needs editorial review, licensed real Eastern Samar aerial/community footage was not supplied, and no music is included. Original geographic graphics are used instead. The source/edit manifest permits replacement with authorized footage and a human narrator. Full sound/pronunciation review by a human is not claimed.

## 8. Rollback

Pre-change HEAD, tracked binary patch and root-project untracked files were saved privately at `C:\Users\Joselito\AppData\Local\Temp\escam-readiness-20261101-154547`. Restore into a separate checkout at the saved HEAD, apply `tracked.patch`, then copy `untracked/` over it. Compare before restoring individual files here. Do not reset this working tree or overwrite unrelated work. The snapshot contains local source and should not be shared publicly.

No production rollback is necessary for this task because nothing was deployed/applied. Provider settings and production records were not changed. Existing server quotas from the earlier authorized security work remain untouched.

## 9. Presentation acceptance checklist

- [x] Clearly labeled fictional records and accounts; no real citizen information.
- [x] Citizen → review → verified map/timeline → volunteer registration → language switch rehearsal.
- [x] Local default collection pause; optional AI/email calls disabled.
- [x] Build, unit, SQL, browser, language and focused accessibility checks.
- [x] Rendered MP4, silent backup, WAV, SRT, source footage, edit manifest and title card.
- [ ] Human film/audio/caption review and native Boronganon proofreading/pronunciation.
- [ ] Test offline playback, projector, sound and backups on the actual presentation equipment.
- [ ] Verify controller, contact and retention/deletion schedule; approve complete notices and rights workflow.
- [ ] Authorize and verify production collection restrictions; local controls are not proof of a live pause.
- [ ] Rehearse actual backend and backup restoration in staging; separately approve deployment if needed.

Security baseline: [OWASP ASVS 5.0](https://asvs.owasp.org/). Legal review source: [National Privacy Commission — Data Privacy Act](https://privacy.gov.ph/data-privacy-act/). These references guide review; they do not certify this application.
