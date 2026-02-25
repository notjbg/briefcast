# BriefCast

BriefCast is a single-page pre-flight weather briefing app that translates aviation weather jargon into plain English for pilots.

## Stack

- `public/index.html`: Vanilla HTML/CSS/JS app (single file)
- `api/*.js`: Vercel serverless functions (Node.js)
- No framework, no build step, no external dependencies

## Endpoints

- `GET /api/airports` — top 200 airport database
- `GET /api/metar?ids=KORD,KLAX` — METAR pull from aviationweather.gov
- `GET /api/taf?ids=KORD` — TAF pull from aviationweather.gov
- `GET /api/briefing?from=KORD&to=KLAX` — full briefing (METAR/TAF/AFD/hazards/PIREPs + optional AI summary)
- `POST /api/waitlist` — waitlist email capture

## Environment Variables

- `ANTHROPIC_API_KEY` (optional): enables AI plain-English translation in `/api/briefing`

## Local Development

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Disclaimer

Not for operational flight planning. Always verify with official FAA/NWS sources.
