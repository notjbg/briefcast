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
- `GET /api/briefing?from=KORD&to=KLAX` — full briefing (METAR/TAF/AFD/hazards/PIREPs + optional AI summary)
- `POST /api/waitlist` — waitlist email capture (via Resend)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Optional | Enables AI plain-English translation in `/api/briefing` |
| `RESEND_API_KEY` | Optional | Enables waitlist email capture via Resend |

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
