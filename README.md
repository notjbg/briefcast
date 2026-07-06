# BriefCast

BriefCast is a single-page pre-flight weather briefing app that translates aviation weather jargon into plain English for pilots.

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
- `POST /api/waitlist` — waitlist email capture (via Resend)

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
