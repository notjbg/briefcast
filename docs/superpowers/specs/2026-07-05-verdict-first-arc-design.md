# BriefCast Verdict-First Arc — Design

**Date:** 2026-07-05
**Status:** Approved
**Goal:** Level up BriefCast from a jargon fetcher into a decision tool for GA/VFR pilots, centered on a deterministic Go/No-Go verdict.

## Context

BriefCast v1 aggregates METAR/TAF/AFD/PIREP/SIGMET/TFR data with caching, rate limiting, and tests — but the AI translation (the product's entire point) is OFF in production (no `ANTHROPIC_API_KEY` set; live `/api/briefing` returns the fallback template). The repo has been frozen since 2026-03-29. Audience decision: GA/VFR private pilots. Centerpiece decision: a Go/No-Go verdict.

**Non-negotiable constraint:** the verdict is deterministic — a pure, tested function of weather factors vs minimums. The AI narrates the verdict; it never decides it. Every verdict carries an advisory disclaimer referencing 14 CFR 91.103.

## Architecture Overview

Five components, in dependency order:

1. **Verdict engine** — `public/verdict.js`, pure function, shared server/client
2. **Departure-window timeline** — `api/_timeline.js`, TAF → hourly category/verdict strip
3. **AI narrative via Vercel AI Gateway** — replaces direct Anthropic call in `api/briefing.js`
4. **Frontend overhaul** — verdict hero + timeline + restyled decoded sections in `public/index.html`
5. **Trust chrome** — disclaimers, data-age stamps, stale badges

Stack unchanged: vanilla single-file frontend, zero build step, Vercel serverless CommonJS functions, `bun test`.

## Component 1: Verdict Engine

**File:** `public/verdict.js` — dependency-free, UMD-style export (attaches to `window.BriefcastVerdict` in browser; `module.exports` guard for CommonJS `require` from `api/`). Single source of truth — no duplicated logic. `api/` requires it via relative path (`require('../public/verdict.js')`); Vercel's file tracing follows static requires.

**Input:**

```js
computeVerdict(factors, minimums) -> { verdict, reasons }
```

- `factors`: `{ departure: { ceilingFt, visibilitySm, windKt, gustKt, category }, destination: { ... }, hazards: { convectiveSigmetAtEndpoint, tfrAtEndpoint, sigmetOnRoute, airmetOnRoute, hazardDataOk }, dataOk: { departureMetar, destinationMetar } }`
- `minimums`: `{ ceilingFt, visibilitySm, windKt, gustKt, label }` — label is `"standard"` or `"personal"`

**Output verdicts:** `GO | MARGINAL | NO-GO | INSUFFICIENT DATA`, plus `reasons`: an array of `{ severity, code, text }` (e.g. `{ severity: 'no-go', code: 'ceiling_below_min', text: 'Ceiling 800 ft at KORD is below your 3,000 ft minimum' }`). Reasons are exhaustive — every rule that fired appears; a GO verdict includes positive confirmations.

**Rules (evaluated in severity order):**

| Verdict | Trigger |
|---|---|
| INSUFFICIENT DATA | Missing/unparseable METAR at either endpoint |
| NO-GO | IFR or LIFR category at either endpoint; ceiling or visibility below minimums at either endpoint; convective SIGMET touching an endpoint; TFR at an endpoint |
| MARGINAL | MVFR at either endpoint; gusts above gust minimum; sustained wind above wind minimum; any SIGMET/AIRMET on route; hazard data fetch failed (`hazardDataOk === false`) |
| GO | None of the above fired |

**Pessimistic degradation invariant:** any data gap moves the verdict toward caution, never toward GO. Hazard-fetch failure caps the verdict at MARGINAL with an explicit reason chip. Missing gust data is treated as gust = sustained wind (not zero-risk).

**Default (standard) minimums:** ceiling 3,000 ft, visibility 5 sm, wind 15 kt, gusts 20 kt. Conservative-VFR by design.

**Personal minimums:** edited in the UI, persisted in `localStorage`, applied by re-running `computeVerdict` client-side with the same factors the API returned. The server always computes and caches the standard-minimums verdict — personal minimums never enter the server cache key or query string.

## Component 2: Departure-Window Timeline

**File:** `api/_timeline.js` — pure function over aviationweather.gov TAF JSON (`fcsts` array).

- Buckets the next 12 hours (hourly) for departure and destination.
- Each hour: flight category (from forecast ceiling/visibility, using existing `calculateFlightCategory` logic generalized to TAF fields) + verdict (via the verdict engine, weather factors only — hazards excluded since SIGMETs/TFRs aren't hourly-forecastable here; timeline hours are annotated "weather only").
- Handles TAF period types: FM (from), BECMG, TEMPO/PROB (TEMPO/PROB degrade the hour to the worse of base and TEMPO conditions — pessimistic invariant again).
- Output shape: `{ departure: [{ hourIso, category, verdict }...], destination: [...] }`, included in the `/api/briefing` payload as `timeline`.
- Missing or unparseable TAF → `timeline: null`; the frontend omits the strip. Never an error.

## Component 3: AI Narrative via Vercel AI Gateway

**File:** `api/briefing.js` (modify `maybeTranslateWithAnthropic`).

- Endpoint: Vercel AI Gateway (`https://ai-gateway.vercel.sh/v1/messages`), model `claude-haiku-4-5`, auth via `AI_GATEWAY_API_KEY` env var. Direct-`x-api-key`-plus-Bearer footgun does not apply (plain `fetch`, single auth header) — but do NOT reintroduce `@anthropic-ai/sdk`.
- `ANTHROPIC_API_KEY` path removed; `AI_GATEWAY_API_KEY` absent → same graceful fallback as today (template summary, `aiUsed: false`).
- Prompt rewritten: input now includes the computed verdict + reasons. Instructions: explain the verdict and conditions in plain English for a VFR pilot; **never contradict the verdict**; never output a go/no-go decision of your own; plain language, no invented data.
- Zod schema gains `verdictExplanation` (string) alongside existing fields. Validation, 12s timeout, and catch-and-fallback behavior unchanged.
- Post-validation guard: if the AI text contains a contradicting verdict phrase (e.g. says "good to go" when verdict is NO-GO), discard the AI narrative and fall back — belt and suspenders.

**Owner action required:** set `AI_GATEWAY_API_KEY` in the Vercel project (briefcast) — same gateway account as plaincast. Until then, prod runs deterministic-only (which is now a real product, unlike before).

## Component 4: Frontend Overhaul

**File:** `public/index.html` (stays single-file, zero-build; loads `/verdict.js` via `<script>`).

Layout top-to-bottom:
1. **Verdict hero** — full-width card, color-coded (green/amber/red/gray), verdict word large, reason chips beneath, "using standard VFR minimums / your personal minimums" tag, edit-minimums affordance opening an inline editor (ceiling/vis/wind/gust inputs, save to localStorage, instant client-side recompute).
2. **Advisory line** — persistent, non-dismissable, directly under the hero: "Advisory only — not an official weather briefing. Pilots must comply with 14 CFR 91.103." Link to 1800wxbrief.com.
3. **Timeline strip** — hourly colored blocks per endpoint with a plain caption (e.g. "Marginal now — improving to GO after 14:00Z"), "weather only" annotation.
4. **AI route narrative** (when available), then the existing decoded METAR/TAF/AFD/hazards/PIREPs sections restyled to sit beneath the verdict.
5. **Data-age stamps** on every data block ("observed 23 min ago") and a stale badge when the API marks `stale`.

No framework, no build step, no new frontend dependencies.

## Component 5: Trust Chrome

- Disclaimer placement as above; also in the footer and in the AI narrative block ("AI-generated explanation of the deterministic verdict").
- Verdict card always states which minimums produced it.
- Every degradation (stale cache, hazard fetch failure, missing TAF) is visible as a chip or badge — no silent gaps.

## Data Flow

```
/api/briefing?from=X&to=Y
  → fetch METAR/TAF/PIREP/SIGMET/TFR/AFD (existing, parallel)
  → extract factors (new: _factors extraction in briefing.js)
  → computeVerdict(factors, STANDARD_MINIMUMS)   [public/verdict.js]
  → buildTimeline(tafs)                          [api/_timeline.js]
  → AI narrative via Gateway (verdict-aware prompt)
  → payload: { verdict, reasons, factors, timeline, ...existing fields }
  → cached 5 min (standard-minimums verdict only)

Client:
  render payload → if personal minimums in localStorage:
    computeVerdict(payload.factors, personalMinimums) → re-render hero
```

## Error Handling

- Every degradation is pessimistic and visible (see invariant in Component 1).
- Existing per-source `.catch` fallbacks, rate limiting, and 500 handling unchanged.
- AI failure → deterministic verdict + template narrative; `aiUsed: false`.

## Testing

`bun test`, extending the existing suites:

- **Verdict engine (table-driven):** category boundaries (VFR/MVFR/IFR/LIFR edges), ceiling/vis exactly-at-minimum (at-minimum passes; below fails), gust/wind limits, personal vs standard minimums, convective SIGMET / TFR no-go triggers, hazard-fetch-failure capping, missing-METAR → INSUFFICIENT DATA, missing-gust treatment, reasons completeness.
- **Timeline parser:** real TAF JSON fixtures (checked into `test/fixtures/`), FM/BECMG/TEMPO handling, TEMPO pessimism, missing TAF → null, hour bucketing across period boundaries.
- **AI contract:** schema validation with `verdictExplanation`, contradiction-guard discard path, missing-key fallback.
- Existing CI pipeline runs all of it.

## Out of Scope (this arc)

- Launch/distribution work, waitlist conversion, monetization
- Route map / radar visualization
- Winds aloft, icing/turbulence products, multi-leg routes
- SSR/framework migration, share cards

## Delivery

Single PR (`notjbg/verdict-first-arc`), version bump, existing CI green. Execution by Opus 4.8 subagents; strategy/review by Fable (per owner's standing instruction).
