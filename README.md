# BriefCast

BriefCast is a single-page pre-flight weather briefing app that translates aviation weather jargon into plain English for pilots.

## Design: the Flight Strip

The UI is styled as a printed **flight strip** — the paper progress strips used in air-traffic control. Briefings render on a paper "bay" with monospace data columns, a departure-window timeline bay, and the Go/No-Go verdict presented as a rubber-stamped clearance (GO / NO-GO / MARGINAL / INSUFFICIENT DATA) pressed onto the strip. A shared token set (paper, ink, bay-blue, rule) and condensed display type (Barlow Condensed) + monospace data type (IBM Plex Mono) carry the identity across the app, the route map, and the generated share cards.

## Stack

- `public/index.html`: Vanilla HTML/CSS/JS app (single file, zero build step)
- `api/*.js`: Vercel serverless functions (Node.js)
- Minimal dependencies: `zod` (AI response validation), `resend` (waitlist email capture)

## Endpoints

- `GET /api/airports` — top 200 airport database
- `GET /api/metar?ids=KORD,KLAX` — METAR pull from aviationweather.gov
- `GET /api/taf?ids=KORD` — TAF pull from aviationweather.gov
- `GET /api/briefing?from=KORD&to=KLAX` — full briefing (METAR/TAF/AFD/hazards/PIREPs + optional AI summary). The payload also includes:
  - `verdict` — deterministic Go/No-Go: `{ verdict, reasons, minimums, explanation }`
  - `factors` — the individual data factors (ceiling, visibility, wind, hazards, etc.) that fed the verdict
  - `timeline` — departure-window outlook: `{ departure, destination } | null`, each an array of hourly slots (`{ hourIso, category, verdict }`) covering the next 12 hours. Weather-only (no traffic/NOTAM data).
  - `map` — route-map payload for the Leaflet strip, or `null` when either airport lacks coordinates: `{ from, to, route, hazardPolygons }`. `from`/`to` are `{ icao, lat, lon, category }`; `route` is a 32-point great-circle polyline (`[lat, lon]` pairs); `hazardPolygons` is an array of `{ kind: 'convective' | 'sigmet' | 'airmet', coords }` for SIGMET/AIRMET overlays.
- `GET /api/og?from=KORD&to=KLAX` — 1200×630 PNG share card (Open Graph). Renders the current Go/No-Go verdict as a stamped flight strip. The verdict/category are **never** trusted from query params: the endpoint validates only that `from`/`to` look like airport codes, then fetches its own `/api/briefing` and renders from that payload. Any missing/invalid params or any upstream failure degrades to a generic branded card at HTTP 200 (never a 500 or JSON body). Fonts are embedded (Barlow Condensed + IBM Plex Mono); on font-fetch failure Satori falls back to bundled Noto Sans.
- `POST /api/waitlist` — waitlist email capture (via Resend)

## Permalinks & share cards

A rendered briefing is shareable. The app rewrites the URL to `/?from=KORD&to=KLAX` (via `history.replaceState`) once a briefing renders, and a **Copy link** button copies that permalink. Loading a `?from=…&to=…` URL replays the exact submit path (same validation, loading UX, and render pipeline). The permalink also drives the `og:image` meta tag, pointing social unfurls at `/api/og?from=…&to=…` so a shared link previews as the stamped verdict card.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Optional | Enables verdict-aware AI plain-English narratives in `/api/briefing` via Vercel AI Gateway. Absent/failed → deterministic verdict still returned, `aiUsed: false`. |
| `RESEND_API_KEY` | Optional | Enables waitlist email capture via Resend |

## Go / No-Go verdict

Every briefing carries a deterministic Go / No-Go verdict computed by a shared engine (`public/verdict.js`) that runs identically on the server and in the browser — the AI never decides the verdict, it only narrates it. The verdict is measured against your **personal minimums**, which are stored in `localStorage` and edited client-side, so changing them recomputes the verdict instantly without touching the server cache. The engine **degrades pessimistically**: any missing, stale, or unparseable data pushes the verdict toward No-Go rather than assuming conditions are fine. Everything here is advisory only and does not satisfy the pilot-in-command's preflight-action obligation under **14 CFR 91.103** — always verify against official FAA/NWS sources before flight.

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Tests

```bash
npm test
```

Runs unit tests for core weather parsing, flight category calculation, and briefing logic using Node.js built-in test runner.

## Disclaimer

Not for operational flight planning. Always verify with official FAA/NWS sources.
