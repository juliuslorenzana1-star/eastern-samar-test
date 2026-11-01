# Eastern Samar Community Action Map — 2:30 production package

**Bridging Citizen Voices and Collective Action**

The second attached brief supersedes the earlier 90–120 second duration. Target: exactly 150 seconds, 1920 × 1080, 16:9, 30 fps, H.264 MP4; English narration with the selected Boronganon phrase. No paid generation, API voice, stock subscription, external AI function or email delivery is used.

## Produced assets and provenance

Generated files live in ignored `presentation-output.local/` (keep an offline copy):

- `Eastern-Samar-rehearsal-150s.mp4`: rendered local product rehearsal with narration and selectable English subtitle track.
- `Eastern-Samar-no-narration.mp4`: video backup without audio narration. Use `captions.srt` separately if desired.
- `voiceover.wav` and seven scene WAVs: offline Microsoft David Desktop synthetic draft narration. Native pronunciation and delivery need human review.
- `captions.srt`: English transcript. Sentence timing is estimated within measured narration segments; review synchronization in an editor before public screening.
- `title-card.svg`, `title-card.png`: original clean geographic title card, exact tagline and credits. No government endorsement implied.
- Seven PNG shot previews and `source-footage/*.webm`: actual browser recordings of the current local application, driven through real UI controls with a fictional in-memory transport.
- `manifest.json`: seven-scene edit plan, durations, source file paths and rehearsal assertions; `render-verification.json`: rendering configuration and measured speech lengths.

Original graphics replace the requested aerial/community stock footage because no licensed Eastern Samar footage was supplied. No generic AI people, invented interviews, endorsements, fabricated impact figures or unlicensed music are used. The film is a **rehearsal**, not a claim that the local release has been deployed. Local interfaces and isolated data are conspicuously labeled. The map demonstrates offline fallback because third-party tiles are blocked; do not present it as full street-map coverage.

Boundary shape comes from the repository's geographic reference data: geoBoundaries / NAMRIA, PSA, OCHA, CC BY 3.0 IGO. See `src/assets/GEOGRAPHY.md`. The title graphic includes attribution. `demo-evidence.png` is an original graphic explicitly stating that it is fictional evidence, not a documentary incident photograph.

## Shot list, storyboard and captions

| Time | Visual and real action | On-screen caption | Transition |
|---|---|---|---|
| 00:00–00:25 | Original Eastern Samar silhouette/title composition; establish the problem | EVERY COMMUNITY HAS A VOICE. | Hold with restrained geographic composition |
| 00:25–00:45 | Actual local homepage and map | Platform name and exact tagline | Clean cut to product |
| 00:45–01:15 | Open report form, select Environment, enter fictional description, attach original demo graphic, choose map point, submit, show receipt | REPORT. REVIEW. VERIFY. | Match action cuts; no simulated success toast |
| 01:15–01:40 | Demo moderator reviews real form, selects Verified; return as guest, open report details and timeline | FROM CONCERNS TO VISIBILITY. | Cut between role perspectives; retain demo label |
| 01:40–02:00 | Volunteer board → fictional activity detail → consent → registration success | FROM PARTICIPATION TO ACTION. | Cut on navigation/action |
| 02:00–02:15 | Switch English → Filipino → Waray; original report prose stays untouched | AN IMO TINGOG IMPORTANTE. | Hold long enough to read labels |
| 02:15–02:30 | Original closing geographic title card and website | Exact tagline | Clean cut and end hold |

The complete voiceover, visual notes, titles and timing are in `scripts/presentation/storyboard.json`; rendered English captions contain the same narration. Organization activity creation is not shown: the rehearsal does not implement a fictional organizer workflow beyond the existing curated demonstration activity. No real volunteering or service hours are claimed.

## Reproduce and edit

1. `npm.cmd run demo:presentation` opens an isolated Edge rehearsal. Use **that window** and its Demo resident / moderator / guest selector. The ordinary localhost browser does not contain Playwright interception. Records reset when the process ends.
2. `npm.cmd run test:presentation` rehearses and asserts all seven scenes. `npm.cmd run video:record` records scene source WebMs at 1080p. Port 5184 must be free. Playwright requires its free FFmpeg recording component (`node node_modules/playwright-core/cli.js install ffmpeg`).
3. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/presentation/voiceover.ps1` renders only local SAPI narration. It creates files, changes no machine policy permanently and calls no paid provider. A human narrator may replace these WAVs with licensed/original recordings. Keep each scene below its duration.
4. Point `FFMPEG_PATH` to a locally available FFmpeg executable; then `node scripts/presentation/render.mjs`. This session used a temporary free FFmpeg binary from `@ffmpeg-installer/win32-x64` 4.1.0. It is not an app dependency. The edit script + JSON manifest are the reproducible editing project; no proprietary editor project is claimed.
5. Import seven source WebMs into an editor at the table's timecodes. Use straight cuts initially, modest cross-dissolves only between noninteractive scenes. Avoid zooming body text until illegible. Add licensed authentic Eastern Samar footage only with ownership/license records and informed consent where appropriate.
6. Review captions, Philippine place-name pronunciation, Boronganon phrase, speech pacing and privacy label visibility. Prefer a human local narrator for the presentation master. Music is optional; none is included. If added, use an owned/licensed restrained instrumental, mixed below intelligible speech (approximately −20 to −26 LUFS under narration as a starting point, then listen).
7. Before calling footage a production walkthrough, approve a deployment separately and compare the same flows against that deployed release in staging/authorized accounts. Do not record real citizens, passwords or private records. This task does not deploy.
8. Export H.264, yuv420p, 1080p, 30 fps, AAC 48 kHz stereo, fast-start MP4. Keep an offline MP4, silent backup, WAV, SRT, title PNG and browser rehearsal instructions on the presentation computer and a second storage device. Test playback, projector framing, captions and sound before 7 November.

## Editorial acceptance gates

- [ ] Human review of the rendered film from beginning to end, including sound and subtitle timing.
- [ ] Native Boronganon interface and pronunciation review; no claim of native certification.
- [ ] Licensed authentic footage/music if replacing the original geographic graphics; otherwise retain the honest graphic treatment.
- [ ] Confirm that local rehearsal labels stay visible and presentation narration does not imply deployment or verified community outcomes.
- [ ] Privacy release blockers acknowledged; only fictional, isolated demonstrations permitted.
- [ ] Production/staging integration and deployment matching verified before claiming a live launch.
