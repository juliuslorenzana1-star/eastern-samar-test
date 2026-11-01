# Estehanon Civic Interface

The presentation preserves the existing civic map design and its working desktop/mobile flows. The design system names and documents that established direction; it does not replace it with a new dashboard before release.

- Geographic hierarchy: Eastern Samar boundary and municipality context first; report location and status second; optional supporting metrics last. Never imply approximate coordinates are survey boundaries.
- Color: deep navy for navigation/film framing, coastal teal for action, off-white for reading surfaces. Keep existing category/status colors and paired text labels; never use color as the only signal.
- Typography: preserve the app's existing heading/body styles. Use Georgia with Segoe UI fallbacks for original film title cards; no remote paid font dependency.
- Spacing: retain current responsive tokens and page gutters. Wrap translated controls and headings. Do not shrink mobile body copy to fit.
- Interaction: one primary action per form step, visible keyboard focus, existing dialog focus trap and restoration, reduced-motion support, persistent language/theme preferences. Labels and original resident content must survive language switching.
- Map: retain municipality geometry, attribution, category legends, filters, details and mobile tap/scroll behavior. An unavailable tile provider must show an honest fallback, not invented geographic detail.
- Components: use existing primary/outline/icon buttons, report receipt, timeline, volunteer consent dialog and staff review queue. The demo label is a clearly separate rehearsal overlay, never a production achievement badge.
- Content: exact film tagline **Bridging Citizen Voices and Collective Action**. No invented engagement statistics, endorsements, testimonials or emergency response promises.

See LANGUAGE_MODE.md for native Boronganon review needs. The new privacy pause banner is translated; internal production assets and legal decision records remain in English for operator review.
