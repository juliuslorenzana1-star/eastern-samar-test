# Eastern Samar Community Action Map

A frontend-only React prototype for mapping and tracking community-reported concerns across Eastern Samar.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The map uses OpenStreetMap tiles and needs an internet connection.

## Prototype scope

- Leaflet map centered on Eastern Samar with clickable community reports.
- Filters for municipality, issue category, status, date range, and text search.
- Local report form with a map-picked location and optional photo selection.
- Six categories covering infrastructure, disaster resilience, health and services, education and youth, livelihood, and the environment.

All seeded reports are illustrative placeholders, not actual community reports or official findings. New reports exist only in browser memory and disappear when the page is refreshed. Photos are not uploaded. There is no authentication, database, moderation workflow, or persistent storage yet. Do not enter personal or sensitive information.
