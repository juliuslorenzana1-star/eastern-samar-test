# English, Filipino, and Waray-Waray language mode

Implemented locally on 1 November 2026. No production deployment, database migration, security-policy change, API activation, or billing-setting change was performed for this feature.

## Interface behavior

- English (`en`) is the default. Filipino (`fil`) and Waray-Waray — Boronganon (`war`) are selected from the globe dropdown in the public navigation, resident preferences/mobile settings, operations header, and relevant dialogs.
- Selection persists as `escam.language` in localStorage, works before and after login, and updates the document's language. Blocked storage does not prevent switching within the current page.
- Switching updates the interface without refreshing, changing component keys, clearing fields, changing the current tutorial step, or replacing authentication sessions. Long text wraps within the existing layouts. The compact mobile volunteer label uses the familiar noun “Volunteer”.
- The requested Waray welcome, supporting paragraph, “Pagreport hin Problema”, and “Kitaa an Mapa” are present. Existing English and Filipino layouts and actions remain available.
- Public reports, map/filter controls, report forms, validation, notifications, resident profiles, volunteers, recognition, onboarding, staff review, administration, operations, emergency guidance, accessibility labels, loading states, and empty states use the shared catalogs.

## Translation boundaries

Report titles/descriptions, user names and aliases, barangay/municipality names, organizer descriptions, tasks, supplies, skills supplied by organizers, moderator notes, evidence, telephone numbers, official source titles, government documents, and basemap place names are not automatically translated. Controlled category, role, status, and priority labels are translated only when displayed. Form values and API identifiers remain unchanged.

New/unknown backend or provider error details fall back to their original English text. Browser-owned date-picker chrome, browser permission prompts, map-provider attribution and official source material remain controlled by their respective providers/browser. These are outside the application's translation catalogs. No known application-authored static JSX labels remain untranslated according to the source audit; that audit cannot certify every possible future backend error or user-generated value.

## Implementation and maintenance

`src/i18n/config.js` initializes i18next/react-i18next. Readable English phrases are stable translation keys; English is also the explicit fallback. Interpolation keeps values separate from translated sentences. Saved system notices retain their originating message/parameters so they can update after switching. Compound report warnings remain separate messages rather than becoming an untranslatable concatenated sentence.

Catalogs are `src/locales/{en,fil,war}/translation.json`. English ships with the app; optional catalogs load on demand and are cached after the first selection. Each optional catalog is about 26 KiB gzipped in the verified production build. They require no translation service or API key.

Edit `scripts/translations.tsv` to review phrase pairs, then run `npm run i18n:check`. The build script regenerates catalog JSON, checks known source keys for translation coverage, and the source audit finds hardcoded static JSX labels. Use explicit `t(...)` calls at interface boundaries; do not pass report bodies or names to the translator. Dynamic status displays should use `formatStatus(...)`; never use translated labels in database comparisons, select values, routing, or requests.

Browser `Intl` formatting uses Philippine locales and Asia/Manila in the shared date helper. Waray has no dependable browser-wide CLDR support, so date/number formatting deliberately uses `fil-PH` as the shared Philippine month-vocabulary fallback instead of an implicit US locale. The document language remains `war`. Native form validation messages use the selected language and clear when the field is edited. Stored ISO dates and analytic month keys remain unchanged.

## Boronganon review notes

The Waray catalog follows the supplied glossary and uses conversational phrasing with familiar technical words: Report, Email, Password, Map/Mapa, Volunteer, Login, and account. It has not been certified by a native Boronganon reviewer. Review these terminology choices with local speakers before treating the wording as authoritative:

| Term | Current wording | Review question |
| --- | --- | --- |
| Community Pulse | Pulso han Komunidad | Is this locally familiar, or should the heading describe community conditions more directly? |
| Verification / resolution | Pagpamatuod / Pagsulbad | Keep these distinct; verify the clearest non-government-endorsing wording. |
| Environmental Champion | Paraataman han Palibot | Confirm the local preference for the recognition title. |
| Community Builder | Parabulig ha Pagparig-on han Komunidad | Check length and natural phrasing for a badge. |
| Review / reviewer | Pagrepaso / nagrerepaso | Confirm preferred spelling/register and whether the borrowed “Moderator” is clearer. |
| Storage/usage allowance | Allowance / limitasyon | Check clarity for residents encountering upload/submission limits. |
| Geographic boundaries | Higad han bungto/probinsya | Confirm local geographic terminology without implying a legal boundary survey. |
| Dates | Philippine month vocabulary fallback | Confirm preferred Waray month abbreviations for any future custom date formatter. |

No automatic/paid translation provider was used. Literal glossary mappings alone are not a substitute for native review of the longer privacy, emergency, and moderation guidance.

## Verification

Run `npm run i18n:check`, `npm test`, `npm run lint`, and `npm run build`. The language browser suite is `npm run test:i18n:browser` against a local preview server (`UI_TEST_URL` can override its default `http://127.0.0.1:5183/`).

The local browser suite intercepts every non-local request and checks all three languages at 320, 390, 768, and 1440 pixels, persistence after reload, no language-triggered navigation, untouched resident content, mobile settings, credentials retained while changing languages, localized native validation, report payloads, volunteer consent/registration, and moderator notes/status payloads. Screenshots/results are stored under `test-results.local/i18n/` (gitignored). Existing English responsive, interface, onboarding, recognition, and operations suites are also used for regression checks.

Production account creation, uploads, AI calls, email sending, and live moderator changes are not part of these tests. Existing security/database tests remain separate and unchanged by localization behavior.

Verified results on 1 November 2026: 1,160 catalog keys with zero missing reviewed translations; zero untranslated static JSX labels; 55 passing unit tests; 4 passing isolated database tests; successful Vite build; lint passed with one pre-existing unused-import warning in the unrelated `project-hiram/tests/inventory-photos.test.mjs`. The multilingual browser suite passed all eight scenario groups. Existing English responsive/report/volunteer/interface/operations checks passed; onboarding and mobile-recognition suites passed after retaining the original Skip-tour keyboard boundary. Waray 320-pixel and Filipino 1440-pixel screenshots were inspected visually. The new browser suite deliberately blocks basemap tiles, so its screenshots show the localized map fallback rather than a production tile-availability check.
