# BriefCast Verdict-First Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic Go/No-Go verdict engine, TAF departure-window timeline, verdict-aware AI narrative via Vercel AI Gateway, and a verdict-hero frontend to BriefCast.

**Architecture:** A pure, dependency-free verdict module (`public/verdict.js`, UMD) is shared by the serverless API and the browser. `api/briefing.js` extracts weather factors, computes the standard-minimums verdict, builds a TAF timeline, and asks the AI to *explain* (never decide) the verdict. The single-file frontend renders a verdict hero and recomputes with personal minimums from localStorage client-side.

**Tech Stack:** Vanilla JS single-file frontend (zero build), Vercel serverless CommonJS functions, `bun test`, zod, Vercel AI Gateway + claude-haiku-4.5.

## Global Constraints

- The verdict is deterministic. AI never decides or contradicts it.
- Pessimistic degradation: any data gap moves the verdict toward caution, never toward GO.
- Standard minimums: ceiling 3,000 ft, visibility 5 sm, wind 15 kt, gusts 20 kt.
- Ceiling/visibility below minimums → NO-GO. Wind/gust above limits → MARGINAL.
- Personal minimums live in localStorage only; they never enter server cache keys or query strings.
- Zero build step; no new frontend dependencies; no `@anthropic-ai/sdk` (plain `fetch` only).
- All new backend logic is CommonJS (`require`/`module.exports`), matching the repo.
- Disclaimer copy (verbatim, everywhere a verdict shows): "Advisory only — not an official weather briefing. Pilots must comply with 14 CFR 91.103."
- Work on branch `notjbg/verdict-first-arc`. Run `bun test` from repo root `~/briefcast`.
- `Date.now()` never called inside pure modules — pass `nowMs`/timestamps as parameters for testability (API handlers may call it).

## File Structure

- Create: `public/verdict.js` — verdict engine (pure, UMD, shared server/client)
- Create: `api/_timeline.js` — TAF → hourly timeline (pure)
- Create: `test/verdict.test.js`, `test/timeline.test.js`, `test/fixtures/taf-kord.json`
- Modify: `api/_utils.js` — extract `categoryFromFields(ceilingFt, visibilitySm)`
- Modify: `api/briefing.js` — factors extraction, verdict, timeline, AI Gateway migration, contradiction guard
- Modify: `test/briefing.test.js` — factors + guard tests
- Modify: `public/index.html` — verdict hero, minimums editor, advisory line, timeline strip, data-age stamps
- Modify: `README.md`, `package.json` (version 1.1.0)

---

### Task 1: Verdict engine (`public/verdict.js`)

**Files:**
- Create: `public/verdict.js`
- Test: `test/verdict.test.js`

**Interfaces:**
- Consumes: nothing (dependency-free by design).
- Produces (used by Tasks 2, 3, 6):
  - `STANDARD_MINIMUMS` = `{ ceilingFt: 3000, visibilitySm: 5, windKt: 15, gustKt: 20, label: 'standard' }`
  - `parseWind(rawOb) -> { windKt: number|null, gustKt: number|null }`
  - `endpointWeatherReasons(name, ep, minimums) -> reasons[]` — weather-only rules for one endpoint (used by timeline)
  - `computeVerdict(factors, minimums) -> { verdict: 'GO'|'MARGINAL'|'NO-GO'|'INSUFFICIENT DATA', reasons: [{ severity: 'insufficient'|'no-go'|'marginal'|'ok', code: string, text: string }] }`
  - Factors shape: `{ departure: { name, ceilingFt, visibilitySm, windKt, gustKt, category }, destination: { same }, hazards: { convectiveSigmetOnRoute: bool, tfrAtEndpoint: bool, sigmetOnRoute: bool, airmetOnRoute: bool, hazardDataOk: bool }, dataOk: { departureMetar: bool, destinationMetar: bool } }`
- Browser global: `window.BriefcastVerdict` with the same exports.

**Rule table (severity order — INSUFFICIENT > NO-GO > MARGINAL):**

| Severity | Code | Trigger |
|---|---|---|
| insufficient | `missing_metar` | `dataOk.departureMetar === false` or `dataOk.destinationMetar === false` |
| no-go | `ifr_conditions` | endpoint `category` is `'IFR'` or `'LIFR'` |
| no-go | `ceiling_below_min` | endpoint `ceilingFt !== null && ceilingFt < minimums.ceilingFt` |
| no-go | `visibility_below_min` | endpoint `visibilitySm !== null && visibilitySm < minimums.visibilitySm` |
| no-go | `convective_sigmet` | `hazards.convectiveSigmetOnRoute` |
| no-go | `tfr_at_endpoint` | `hazards.tfrAtEndpoint` |
| marginal | `mvfr_conditions` | endpoint `category === 'MVFR'` (fires when minimums are looser than MVFR thresholds) |
| marginal | `gusts_above_limit` | effective gust `> minimums.gustKt` (effective gust = `gustKt ?? windKt` — missing gust data is treated as gust = sustained wind, per pessimism invariant) |
| marginal | `wind_above_limit` | `windKt !== null && windKt > minimums.windKt` |
| marginal | `sigmet_on_route` | `hazards.sigmetOnRoute` |
| marginal | `airmet_on_route` | `hazards.airmetOnRoute` |
| marginal | `hazard_data_unavailable` | `hazards.hazardDataOk === false` |

At-minimum passes: `ceilingFt === minimums.ceilingFt` is NOT below minimums; `windKt === minimums.windKt` is NOT above limit. Reasons are exhaustive (every fired rule appears once per endpoint that fired it, with the endpoint name in `text`). A GO verdict gets one `ok` reason: `{ severity: 'ok', code: 'all_clear', text: 'Ceilings, visibility, and winds are at or above your minimums at both endpoints, with no route hazards returned.' }`.

- [ ] **Step 1: Write the failing tests**

Create `test/verdict.test.js`:

```js
const { describe, it, expect } = require('bun:test');
const { computeVerdict, parseWind, endpointWeatherReasons, STANDARD_MINIMUMS } = require('../public/verdict.js');

const CLEAR = { name: 'KDEN', ceilingFt: null, visibilitySm: 10, windKt: 8, gustKt: null, category: 'VFR' };
const HAZARDS_OK = { convectiveSigmetOnRoute: false, tfrAtEndpoint: false, sigmetOnRoute: false, airmetOnRoute: false, hazardDataOk: true };
const DATA_OK = { departureMetar: true, destinationMetar: true };

function factors(dep = {}, dest = {}, hazards = {}, dataOk = {}) {
  return {
    departure: { ...CLEAR, name: 'KORD', ...dep },
    destination: { ...CLEAR, name: 'KLAX', ...dest },
    hazards: { ...HAZARDS_OK, ...hazards },
    dataOk: { ...DATA_OK, ...dataOk }
  };
}

describe('parseWind', () => {
  it('parses sustained wind', () => {
    expect(parseWind('METAR KORD 060251Z 02009KT 10SM BKN025')).toEqual({ windKt: 9, gustKt: null });
  });
  it('parses gusts', () => {
    expect(parseWind('KORD 060251Z 24015G25KT 10SM')).toEqual({ windKt: 15, gustKt: 25 });
  });
  it('parses variable wind', () => {
    expect(parseWind('KORD 060251Z VRB04KT 10SM')).toEqual({ windKt: 4, gustKt: null });
  });
  it('returns nulls when absent or invalid input', () => {
    expect(parseWind('KORD 060251Z 10SM BKN025')).toEqual({ windKt: null, gustKt: null });
    expect(parseWind(null)).toEqual({ windKt: null, gustKt: null });
  });
});

describe('computeVerdict', () => {
  it('returns GO with an all_clear reason when everything is clear', () => {
    const r = computeVerdict(factors(), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('GO');
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0].code).toBe('all_clear');
  });

  it('returns INSUFFICIENT DATA when a METAR is missing, even with other no-go conditions', () => {
    const r = computeVerdict(factors({}, {}, { tfrAtEndpoint: true }, { destinationMetar: false }), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('INSUFFICIENT DATA');
    expect(r.reasons.map((x) => x.code)).toContain('missing_metar');
    expect(r.reasons.map((x) => x.code)).toContain('tfr_at_endpoint');
  });

  it('NO-GO on IFR/LIFR category at either endpoint', () => {
    expect(computeVerdict(factors({ category: 'IFR', ceilingFt: 800 }), STANDARD_MINIMUMS).verdict).toBe('NO-GO');
    expect(computeVerdict(factors({}, { category: 'LIFR', ceilingFt: 300 }), STANDARD_MINIMUMS).verdict).toBe('NO-GO');
  });

  it('NO-GO when ceiling is below minimums; at-minimum passes', () => {
    expect(computeVerdict(factors({ ceilingFt: 2900, category: 'MVFR' }), STANDARD_MINIMUMS).verdict).toBe('NO-GO');
    const at = computeVerdict(factors({ ceilingFt: 3000, category: 'MVFR' }), STANDARD_MINIMUMS);
    expect(at.reasons.map((x) => x.code)).not.toContain('ceiling_below_min');
  });

  it('NO-GO when visibility is below minimums', () => {
    const r = computeVerdict(factors({}, { visibilitySm: 4, category: 'MVFR' }), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('NO-GO');
    expect(r.reasons.find((x) => x.code === 'visibility_below_min').text).toContain('KLAX');
  });

  it('NO-GO on convective SIGMET or TFR', () => {
    expect(computeVerdict(factors({}, {}, { convectiveSigmetOnRoute: true }), STANDARD_MINIMUMS).verdict).toBe('NO-GO');
    expect(computeVerdict(factors({}, {}, { tfrAtEndpoint: true }), STANDARD_MINIMUMS).verdict).toBe('NO-GO');
  });

  it('MVFR is only MARGINAL when personal minimums are looser', () => {
    const loose = { ceilingFt: 1000, visibilitySm: 3, windKt: 15, gustKt: 20, label: 'personal' };
    const r = computeVerdict(factors({ ceilingFt: 2500, category: 'MVFR' }), loose);
    expect(r.verdict).toBe('MARGINAL');
    expect(r.reasons.map((x) => x.code)).toContain('mvfr_conditions');
  });

  it('MARGINAL on gusts above limit; missing gust treated as gust = sustained wind', () => {
    expect(computeVerdict(factors({ gustKt: 22 }), STANDARD_MINIMUMS).verdict).toBe('MARGINAL');
    // windKt 22 with gustKt null → effective gust 22 > 20
    const r = computeVerdict(factors({ windKt: 22, gustKt: null }), STANDARD_MINIMUMS);
    expect(r.reasons.map((x) => x.code)).toContain('gusts_above_limit');
    expect(r.reasons.map((x) => x.code)).toContain('wind_above_limit');
    expect(r.verdict).toBe('MARGINAL');
  });

  it('at-limit wind passes', () => {
    const r = computeVerdict(factors({ windKt: 15, gustKt: 20 }), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('GO');
  });

  it('MARGINAL on SIGMET/AIRMET on route and on hazard fetch failure', () => {
    expect(computeVerdict(factors({}, {}, { sigmetOnRoute: true }), STANDARD_MINIMUMS).verdict).toBe('MARGINAL');
    expect(computeVerdict(factors({}, {}, { airmetOnRoute: true }), STANDARD_MINIMUMS).verdict).toBe('MARGINAL');
    const r = computeVerdict(factors({}, {}, { hazardDataOk: false }), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('MARGINAL');
    expect(r.reasons.map((x) => x.code)).toContain('hazard_data_unavailable');
  });

  it('reasons include both endpoints when both fire', () => {
    const r = computeVerdict(factors({ ceilingFt: 900, category: 'IFR' }, { ceilingFt: 800, category: 'IFR' }), STANDARD_MINIMUMS);
    const texts = r.reasons.filter((x) => x.code === 'ifr_conditions').map((x) => x.text).join(' ');
    expect(texts).toContain('KORD');
    expect(texts).toContain('KLAX');
  });
});

describe('endpointWeatherReasons', () => {
  it('returns only weather rules for one endpoint (no hazard rules)', () => {
    const reasons = endpointWeatherReasons('KORD', { ...CLEAR, name: 'KORD', ceilingFt: 800, category: 'IFR' }, STANDARD_MINIMUMS);
    expect(reasons.map((x) => x.code)).toContain('ifr_conditions');
    expect(reasons.every((x) => x.severity === 'no-go' || x.severity === 'marginal')).toBe(true);
  });
  it('returns empty array for clear weather', () => {
    expect(endpointWeatherReasons('KDEN', CLEAR, STANDARD_MINIMUMS)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/verdict.test.js`
Expected: FAIL — `Cannot find module '../public/verdict.js'`

- [ ] **Step 3: Implement `public/verdict.js`**

```js
// BriefCast verdict engine — pure, dependency-free, shared by server (require) and browser (script tag).
// The verdict is DETERMINISTIC. Every data gap degrades pessimistically (toward caution), never toward GO.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BriefcastVerdict = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const STANDARD_MINIMUMS = { ceilingFt: 3000, visibilitySm: 5, windKt: 15, gustKt: 20, label: 'standard' };

  function parseWind(rawOb) {
    if (!rawOb || typeof rawOb !== 'string') return { windKt: null, gustKt: null };
    const m = rawOb.match(/(?:^|\s)(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT(?:\s|$)/);
    if (!m) return { windKt: null, gustKt: null };
    return { windKt: Number(m[2]), gustKt: m[3] ? Number(m[3]) : null };
  }

  function reason(severity, code, text) {
    return { severity, code, text };
  }

  // Weather-only rules for a single endpoint. Used for the main verdict and per-hour timeline verdicts.
  function endpointWeatherReasons(name, ep, minimums) {
    const out = [];
    if (!ep) return out;
    if (ep.category === 'IFR' || ep.category === 'LIFR') {
      out.push(reason('no-go', 'ifr_conditions', `${ep.category} conditions at ${name} — VFR flight is not possible`));
    }
    if (ep.ceilingFt !== null && ep.ceilingFt !== undefined && ep.ceilingFt < minimums.ceilingFt) {
      out.push(reason('no-go', 'ceiling_below_min', `Ceiling ${ep.ceilingFt.toLocaleString()} ft at ${name} is below your ${minimums.ceilingFt.toLocaleString()} ft minimum`));
    }
    if (ep.visibilitySm !== null && ep.visibilitySm !== undefined && ep.visibilitySm < minimums.visibilitySm) {
      out.push(reason('no-go', 'visibility_below_min', `Visibility ${ep.visibilitySm} sm at ${name} is below your ${minimums.visibilitySm} sm minimum`));
    }
    if (ep.category === 'MVFR') {
      out.push(reason('marginal', 'mvfr_conditions', `Marginal VFR conditions at ${name}`));
    }
    const effectiveGust = (ep.gustKt !== null && ep.gustKt !== undefined) ? ep.gustKt : ep.windKt;
    if (effectiveGust !== null && effectiveGust !== undefined && effectiveGust > minimums.gustKt) {
      out.push(reason('marginal', 'gusts_above_limit', `Gusts ${effectiveGust} kt at ${name} exceed your ${minimums.gustKt} kt gust limit`));
    }
    if (ep.windKt !== null && ep.windKt !== undefined && ep.windKt > minimums.windKt) {
      out.push(reason('marginal', 'wind_above_limit', `Sustained wind ${ep.windKt} kt at ${name} exceeds your ${minimums.windKt} kt limit`));
    }
    return out;
  }

  function computeVerdict(factors, minimums) {
    const mins = minimums || STANDARD_MINIMUMS;
    const reasons = [];

    if (!factors || !factors.dataOk || factors.dataOk.departureMetar === false) {
      reasons.push(reason('insufficient', 'missing_metar', `No current METAR available for ${factors?.departure?.name || 'departure'}`));
    }
    if (factors?.dataOk && factors.dataOk.destinationMetar === false) {
      reasons.push(reason('insufficient', 'missing_metar', `No current METAR available for ${factors?.destination?.name || 'destination'}`));
    }

    if (factors?.dataOk?.departureMetar) {
      reasons.push(...endpointWeatherReasons(factors.departure?.name || 'departure', factors.departure, mins));
    }
    if (factors?.dataOk?.destinationMetar) {
      reasons.push(...endpointWeatherReasons(factors.destination?.name || 'destination', factors.destination, mins));
    }

    const hz = factors?.hazards || {};
    if (hz.convectiveSigmetOnRoute) {
      reasons.push(reason('no-go', 'convective_sigmet', 'Convective SIGMET active on or near this route — thunderstorm hazard'));
    }
    if (hz.tfrAtEndpoint) {
      reasons.push(reason('no-go', 'tfr_at_endpoint', 'Temporary Flight Restriction near a route endpoint — verify boundaries before flight'));
    }
    if (hz.sigmetOnRoute) {
      reasons.push(reason('marginal', 'sigmet_on_route', 'SIGMET active on or near this route — review before departure'));
    }
    if (hz.airmetOnRoute) {
      reasons.push(reason('marginal', 'airmet_on_route', 'AIRMET active on or near this route — review before departure'));
    }
    if (hz.hazardDataOk === false) {
      reasons.push(reason('marginal', 'hazard_data_unavailable', 'Hazard data is temporarily unavailable — check aviationweather.gov directly before departure'));
    }

    let verdict = 'GO';
    if (reasons.some((r) => r.severity === 'insufficient')) verdict = 'INSUFFICIENT DATA';
    else if (reasons.some((r) => r.severity === 'no-go')) verdict = 'NO-GO';
    else if (reasons.some((r) => r.severity === 'marginal')) verdict = 'MARGINAL';

    if (verdict === 'GO') {
      reasons.push(reason('ok', 'all_clear', 'Ceilings, visibility, and winds are at or above your minimums at both endpoints, with no route hazards returned.'));
    }

    return { verdict, reasons };
  }

  return { STANDARD_MINIMUMS, parseWind, endpointWeatherReasons, computeVerdict };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/verdict.test.js`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add public/verdict.js test/verdict.test.js
git commit -m "feat: deterministic Go/No-Go verdict engine (shared server/client)"
```

---

### Task 2: Factors extraction + verdict in the briefing payload

**Files:**
- Modify: `api/_utils.js` (extract `categoryFromFields`)
- Modify: `api/briefing.js`
- Test: `test/briefing.test.js` (append), `test/utils.test.js` (append)

**Interfaces:**
- Consumes: `computeVerdict`, `parseWind`, `STANDARD_MINIMUMS` from `require('../public/verdict.js')`; `parseMetarFields`, `calculateFlightCategory` from `./_utils`.
- Produces:
  - `_utils.categoryFromFields(ceilingFt, visibilitySm) -> 'VFR'|'MVFR'|'IFR'|'LIFR'|'UNKNOWN'` (used by Task 3)
  - `briefing.js` internal `buildFactors({ fromCode, toCode, departureMetar, destinationMetar, sigmets, airmets, tfrFeatures, hazardsFetchOk, airportFrom, airportTo }) -> factors` (exported via `_test`)
  - `briefing.js` internal `tfrNearEndpoint(features, airports, radiusDeg = 0.5) -> bool` (exported via `_test`)
  - Payload gains: `verdict: { verdict, reasons, minimums: STANDARD_MINIMUMS }`, `factors` (the full factors object, so the client can recompute with personal minimums).

**TFR geo-filtering (important):** the existing TFR fetch is **nationwide** (`api.weather.gov/alerts/active?event=Temporary Flight Restriction`). A TFR in Florida must not NO-GO a KORD→KLAX flight. Rule: `tfrAtEndpoint` is true only if a TFR feature's geometry (Polygon/MultiPolygon coordinate list, flattened to [lon, lat] pairs) has ANY vertex within `radiusDeg` (0.5° ≈ 30 nm) of either airport's lat/lon. Features with `geometry: null` NEVER set `tfrAtEndpoint` (they stay in the informational `hazards` list only — an unlocatable TFR must not poison every route in the country).

**Convective SIGMET:** the airsigmet fetch is already bbox-scoped to the route. `convectiveSigmetOnRoute` = any returned item whose `airsigmetType` or `hazard` string (uppercased) contains `'CONVECTIVE'` or equals/contains `'CONV'` or `'TS'`. `sigmetOnRoute` = any non-convective SIGMET present; `airmetOnRoute` = any AIRMET present.

- [ ] **Step 1: Write the failing tests**

Append to `test/utils.test.js`:

```js
describe('categoryFromFields', () => {
  const { categoryFromFields } = require('../api/_utils');
  it('classifies boundaries', () => {
    expect(categoryFromFields(400, 10)).toBe('LIFR');
    expect(categoryFromFields(900, 10)).toBe('IFR');
    expect(categoryFromFields(2500, 10)).toBe('MVFR');
    expect(categoryFromFields(3000, 10)).toBe('MVFR'); // <= 3000 is MVFR
    expect(categoryFromFields(3100, 6)).toBe('VFR');
    expect(categoryFromFields(null, 0.5)).toBe('LIFR');
    expect(categoryFromFields(null, null)).toBe('UNKNOWN');
  });
});
```

Append to `test/briefing.test.js` (inside the top-level scope; `buildFactors` and `tfrNearEndpoint` come from the existing `_test` export):

```js
describe('buildFactors', () => {
  const { buildFactors } = _test;
  const base = {
    fromCode: 'KORD',
    toCode: 'KLAX',
    departureMetar: { rawOb: 'METAR KORD 060251Z 02009KT 10SM BKN025 21/17 A2999' },
    destinationMetar: { rawOb: 'METAR KLAX 060253Z 25007KT 10SM SCT250 19/14 A2995' },
    sigmets: [],
    airmets: [],
    tfrFeatures: [],
    hazardsFetchOk: true,
    airportFrom: { icao: 'KORD', lat: 41.98, lon: -87.9 },
    airportTo: { icao: 'KLAX', lat: 33.94, lon: -118.4 }
  };

  it('extracts ceiling, visibility, wind, and category per endpoint', () => {
    const f = buildFactors(base);
    expect(f.departure).toEqual({ name: 'KORD', ceilingFt: 2500, visibilitySm: 10, windKt: 9, gustKt: null, category: 'MVFR' });
    expect(f.destination.category).toBe('VFR');
    expect(f.destination.ceilingFt).toBe(null); // SCT is not a ceiling
    expect(f.dataOk).toEqual({ departureMetar: true, destinationMetar: true });
  });

  it('flags missing METARs', () => {
    const f = buildFactors({ ...base, destinationMetar: {} });
    expect(f.dataOk.destinationMetar).toBe(false);
  });

  it('classifies convective SIGMETs vs plain SIGMETs vs AIRMETs', () => {
    const f = buildFactors({
      ...base,
      sigmets: [{ airsigmetType: 'SIGMET', hazard: 'CONVECTIVE' }, { airsigmetType: 'SIGMET', hazard: 'TURB' }],
      airmets: [{ airsigmetType: 'AIRMET', hazard: 'ICE' }]
    });
    expect(f.hazards.convectiveSigmetOnRoute).toBe(true);
    expect(f.hazards.sigmetOnRoute).toBe(true);
    expect(f.hazards.airmetOnRoute).toBe(true);
  });

  it('propagates hazard fetch failure', () => {
    const f = buildFactors({ ...base, hazardsFetchOk: false });
    expect(f.hazards.hazardDataOk).toBe(false);
  });
});

describe('tfrNearEndpoint', () => {
  const { tfrNearEndpoint } = _test;
  const airports = [{ lat: 41.98, lon: -87.9 }, { lat: 33.94, lon: -118.4 }];
  const feature = (coords) => ({ geometry: { type: 'Polygon', coordinates: [coords] } });

  it('true when a TFR vertex is near an endpoint', () => {
    expect(tfrNearEndpoint([feature([[-87.8, 42.1], [-87.7, 42.0]])], airports)).toBe(true);
  });
  it('false for a distant TFR', () => {
    expect(tfrNearEndpoint([feature([[-80.1, 25.7], [-80.2, 25.8]])], airports)).toBe(false);
  });
  it('false for null geometry (unlocatable TFRs never poison the verdict)', () => {
    expect(tfrNearEndpoint([{ geometry: null }], airports)).toBe(false);
  });
  it('false when airports are unknown', () => {
    expect(tfrNearEndpoint([feature([[-87.8, 42.1]])], [null, null])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/utils.test.js test/briefing.test.js`
Expected: FAIL — `categoryFromFields` not exported; `buildFactors`/`tfrNearEndpoint` undefined on `_test`.

- [ ] **Step 3: Implement**

In `api/_utils.js`, refactor `calculateFlightCategory` and export the new function:

```js
function categoryFromFields(ceilingFt, visibilitySm) {
  if (ceilingFt === null && visibilitySm === null) return 'UNKNOWN';
  if ((ceilingFt !== null && ceilingFt < 500) || (visibilitySm !== null && visibilitySm < 1)) return 'LIFR';
  if ((ceilingFt !== null && ceilingFt < 1000) || (visibilitySm !== null && visibilitySm < 3)) return 'IFR';
  if ((ceilingFt !== null && ceilingFt <= 3000) || (visibilitySm !== null && visibilitySm <= 5)) return 'MVFR';
  return 'VFR';
}

function calculateFlightCategory(rawOb) {
  const { ceilingFt, visibilitySm } = parseMetarFields(rawOb);
  return categoryFromFields(ceilingFt, visibilitySm);
}
```

Add `categoryFromFields` and `parseMetarFields` to `module.exports` (parseMetarFields is already exported; add categoryFromFields).

In `api/briefing.js`:

```js
// At top, next to existing requires:
const { computeVerdict, parseWind, STANDARD_MINIMUMS } = require('../public/verdict.js');
const { parseMetarFields } = require('./_utils');

const TFR_RADIUS_DEG = 0.5; // ~30 nm

function flattenCoords(geometry) {
  const out = [];
  function walk(node) {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push([node[0], node[1]]);
      return;
    }
    node.forEach(walk);
  }
  if (geometry && geometry.coordinates) walk(geometry.coordinates);
  return out;
}

function tfrNearEndpoint(features = [], airports = [], radiusDeg = TFR_RADIUS_DEG) {
  const points = airports.filter(Boolean);
  if (!points.length) return false;
  return features.some((f) => {
    const coords = flattenCoords(f && f.geometry);
    return coords.some(([lon, lat]) =>
      points.some((a) => Math.abs(a.lat - lat) <= radiusDeg && Math.abs(a.lon - lon) <= radiusDeg)
    );
  });
}

function endpointFactors(name, metar) {
  const rawOb = metar?.rawOb || '';
  const { ceilingFt, visibilitySm } = parseMetarFields(rawOb);
  const { windKt, gustKt } = parseWind(rawOb);
  return {
    name,
    ceilingFt,
    visibilitySm,
    windKt,
    gustKt,
    category: calculateFlightCategory(rawOb)
  };
}

function isConvective(item) {
  const s = `${item.airsigmetType || ''} ${item.hazard || ''} ${item.phenomenon || ''}`.toUpperCase();
  return s.includes('CONVECTIVE') || s.includes('CONV') || /\bTS\b/.test(s);
}

function buildFactors({ fromCode, toCode, departureMetar, destinationMetar, sigmets = [], airmets = [], tfrFeatures = [], hazardsFetchOk = true, airportFrom, airportTo }) {
  return {
    departure: endpointFactors(fromCode, departureMetar),
    destination: endpointFactors(toCode, destinationMetar),
    hazards: {
      convectiveSigmetOnRoute: sigmets.some(isConvective),
      sigmetOnRoute: sigmets.some((s) => !isConvective(s)),
      airmetOnRoute: airmets.length > 0,
      tfrAtEndpoint: tfrNearEndpoint(tfrFeatures, [airportFrom, airportTo]),
      hazardDataOk: hazardsFetchOk
    },
    dataOk: {
      departureMetar: !!departureMetar?.rawOb,
      destinationMetar: !!destinationMetar?.rawOb
    }
  };
}
```

In the handler, after `pireps`/`afdExtract` are computed and before `aiInput`, add (note: `tfrs` mapping already exists — keep it for the informational hazards list; pass the raw `tfrAlerts.features` to buildFactors):

```js
    const factors = buildFactors({
      fromCode,
      toCode,
      departureMetar,
      destinationMetar,
      sigmets,
      airmets,
      tfrFeatures: tfrAlerts?.features || [],
      hazardsFetchOk,
      airportFrom,
      airportTo
    });
    const verdictResult = computeVerdict(factors, STANDARD_MINIMUMS);
```

Add to the `output` object:

```js
      verdict: { ...verdictResult, minimums: STANDARD_MINIMUMS },
      factors,
```

Extend the `_test` export:

```js
module.exports._test = { summarizeHazards, summarizePireps, selectAfdText, plainRouteSummary, normalizeMetarTimestamps, buildFactors, tfrNearEndpoint };
```

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: PASS (all files)

- [ ] **Step 5: Smoke-test locally**

Run: `bun run dev` (or `vercel dev`) in one shell, then:
`curl -s "http://localhost:3000/api/briefing?from=KORD&to=KLAX" | python3 -m json.tool | head -60`
Expected: payload contains `verdict.verdict` (one of the four values), `verdict.reasons` (non-empty), `factors.departure.category`. If `vercel dev` is unavailable in the environment, skip this step and note it in the task report.

- [ ] **Step 6: Commit**

```bash
git add api/_utils.js api/briefing.js test/utils.test.js test/briefing.test.js
git commit -m "feat: extract weather factors and compute standard-minimums verdict in briefing payload"
```

---

### Task 3: Departure-window timeline (`api/_timeline.js`)

**Files:**
- Create: `api/_timeline.js`
- Create: `test/fixtures/taf-kord.json`
- Test: `test/timeline.test.js`

**Interfaces:**
- Consumes: `categoryFromFields` from `./_utils`; `endpointWeatherReasons`, `STANDARD_MINIMUMS` from `../public/verdict.js`.
- Produces: `buildTimeline(taf, nowMs, hours = 12) -> [{ hourIso, category, verdict }] | null` — `taf` is one aviationweather.gov TAF JSON object (with `fcsts` array; epoch-second `timeFrom`/`timeTo`); `verdict` per hour is `'GO'|'MARGINAL'|'NO-GO'` (weather-only, standard minimums; hazards excluded by design). Returns `null` if `taf?.fcsts` is missing/empty or no period covers any requested hour.

**TAF JSON field notes (aviationweather.gov `/api/data/taf?format=json`):** each `fcsts[]` entry has `timeFrom`/`timeTo` (epoch seconds), `fcstChange` (`null` for base, `'FM'`, `'BECMG'`, `'TEMPO'`, `'PROB'`), `probability`, `wdir`, `wspd`, `wgst`, `visib` (number or string like `"6+"`), `clouds` (`[{ cover: 'BKN', base: 2500 }]` — base already in feet). **Verify this shape against one live pull** (`curl -s "https://aviationweather.gov/api/data/taf?ids=KORD&format=json"`) before finalizing the fixture; if field names differ, adjust fixture AND parser to the real shape and note it.

**Per-hour algorithm:** for each hour `t` (start of hour, `nowMs` rounded down, then +1h increments): (1) base period = the last non-TEMPO/non-PROB `fcsts` entry with `timeFrom*1000 <= t < timeTo*1000` (FM and BECMG both treated as in-effect from `timeFrom` — pessimism handled by the overlay); (2) overlay = any TEMPO/PROB entry covering `t`; (3) hour conditions = the WORSE of base and overlay (worse = lower category rank in VFR > MVFR > IFR > LIFR, and higher wind/gust); (4) `category` via `categoryFromFields`; (5) `verdict`: run `endpointWeatherReasons(icao, hourFactors, STANDARD_MINIMUMS)` — any `no-go` reason → `NO-GO`, else any `marginal` → `MARGINAL`, else `GO`. Hours with no covering base period are skipped (not emitted).

**Field extraction per period:** `ceilingFt` = min `base` among clouds with cover `BKN`/`OVC`/`VV` (null if none); `visibilitySm`: numbers pass through; strings ending in `+` parse the numeric prefix (e.g. `"6+"` → 6); unparseable → null; `windKt` = `wspd ?? null`, `gustKt` = `wgst ?? null`.

- [ ] **Step 1: Create the fixture**

Create `test/fixtures/taf-kord.json` — a realistic TAF with a base period (VFR), an FM period going MVFR, and a TEMPO overlay going IFR. Use epoch seconds anchored at `1751760000` (2026-07-06T00:00:00Z) so tests pass a fixed `nowMs = 1751760000000`:

```json
{
  "icaoId": "KORD",
  "rawTAF": "TAF KORD 052330Z 0600/0706 20010KT P6SM SCT035 FM060600 18012G22KT 5SM BR BKN025 TEMPO 0608/0612 3SM BR BKN008",
  "fcsts": [
    { "timeFrom": 1751760000, "timeTo": 1751781600, "fcstChange": null, "probability": null, "wdir": 200, "wspd": 10, "wgst": null, "visib": "6+", "clouds": [{ "cover": "SCT", "base": 3500 }] },
    { "timeFrom": 1751781600, "timeTo": 1751868000, "fcstChange": "FM", "probability": null, "wdir": 180, "wspd": 12, "wgst": 22, "visib": 5, "clouds": [{ "cover": "BKN", "base": 2500 }] },
    { "timeFrom": 1751788800, "timeTo": 1751803200, "fcstChange": "TEMPO", "probability": null, "wdir": 180, "wspd": 12, "wgst": null, "visib": 3, "clouds": [{ "cover": "BKN", "base": 800 }] }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Create `test/timeline.test.js`:

```js
const { describe, it, expect } = require('bun:test');
const { buildTimeline } = require('../api/_timeline');
const taf = require('./fixtures/taf-kord.json');

const NOW = 1751760000000; // 2026-07-06T00:00:00Z, aligned with fixture

describe('buildTimeline', () => {
  it('returns null for missing/empty TAF', () => {
    expect(buildTimeline(null, NOW)).toBe(null);
    expect(buildTimeline({}, NOW)).toBe(null);
    expect(buildTimeline({ fcsts: [] }, NOW)).toBe(null);
  });

  it('emits one entry per covered hour with ISO timestamps', () => {
    const tl = buildTimeline(taf, NOW, 12);
    expect(tl.length).toBe(12);
    expect(tl[0].hourIso).toBe('2026-07-06T00:00:00.000Z');
    expect(tl[11].hourIso).toBe('2026-07-06T11:00:00.000Z');
  });

  it('base period is VFR and GO', () => {
    const tl = buildTimeline(taf, NOW, 12);
    // Hours 0-5 (00:00-05:00Z) are the base period: 6+ sm, SCT (no ceiling), 10 kt
    expect(tl[0].category).toBe('VFR');
    expect(tl[0].verdict).toBe('GO');
  });

  it('FM period goes MVFR and NO-GO under standard minimums (ceiling 2500 < 3000)', () => {
    const tl = buildTimeline(taf, NOW, 12);
    // Hour 6 (06:00Z) is FM: BKN025, 5sm, 12G22
    expect(tl[6].category).toBe('MVFR');
    expect(tl[6].verdict).toBe('NO-GO');
  });

  it('TEMPO overlay degrades hours pessimistically to IFR', () => {
    const tl = buildTimeline(taf, NOW, 12);
    // Hours 8-11 (08:00-11:00Z) have TEMPO BKN008 3SM → IFR
    expect(tl[8].category).toBe('IFR');
    expect(tl[8].verdict).toBe('NO-GO');
  });

  it('skips hours beyond TAF coverage instead of inventing data', () => {
    // Anchor now 4 hours before the TAF starts: first 4 hours uncovered → skipped
    const tl = buildTimeline(taf, NOW - 4 * 3600_000, 12);
    expect(tl.length).toBe(8);
    expect(tl[0].hourIso).toBe('2026-07-06T00:00:00.000Z');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test test/timeline.test.js`
Expected: FAIL — `Cannot find module '../api/_timeline'`

- [ ] **Step 4: Implement `api/_timeline.js`**

```js
const { categoryFromFields } = require('./_utils');
const { endpointWeatherReasons, STANDARD_MINIMUMS } = require('../public/verdict.js');

const CATEGORY_RANK = { VFR: 3, MVFR: 2, IFR: 1, LIFR: 0, UNKNOWN: 2.5 };

function parseVisib(visib) {
  if (typeof visib === 'number' && Number.isFinite(visib)) return visib;
  if (typeof visib === 'string') {
    const m = visib.match(/^([\d.]+)\+?$/);
    if (m) return Number(m[1]);
  }
  return null;
}

function periodConditions(fcst) {
  const clouds = Array.isArray(fcst.clouds) ? fcst.clouds : [];
  let ceilingFt = null;
  clouds.forEach((c) => {
    if (/^(BKN|OVC|VV)$/.test(String(c.cover || '').toUpperCase())) {
      const base = Number(c.base);
      if (Number.isFinite(base) && (ceilingFt === null || base < ceilingFt)) ceilingFt = base;
    }
  });
  return {
    ceilingFt,
    visibilitySm: parseVisib(fcst.visib),
    windKt: Number.isFinite(fcst.wspd) ? fcst.wspd : null,
    gustKt: Number.isFinite(fcst.wgst) ? fcst.wgst : null
  };
}

// Pessimistic merge: take the worse of base and overlay for every field.
function worseOf(a, b) {
  if (!b) return a;
  const minCeil = [a.ceilingFt, b.ceilingFt].filter((v) => v !== null);
  const minVis = [a.visibilitySm, b.visibilitySm].filter((v) => v !== null);
  const maxWind = [a.windKt, b.windKt].filter((v) => v !== null);
  const maxGust = [a.gustKt, b.gustKt].filter((v) => v !== null);
  return {
    ceilingFt: minCeil.length ? Math.min(...minCeil) : null,
    visibilitySm: minVis.length ? Math.min(...minVis) : null,
    windKt: maxWind.length ? Math.max(...maxWind) : null,
    gustKt: maxGust.length ? Math.max(...maxGust) : null
  };
}

function isOverlay(fcst) {
  const c = String(fcst.fcstChange || '').toUpperCase();
  return c === 'TEMPO' || c.startsWith('PROB') || fcst.probability != null;
}

function buildTimeline(taf, nowMs, hours = 12) {
  const fcsts = taf && Array.isArray(taf.fcsts) ? taf.fcsts : null;
  if (!fcsts || !fcsts.length) return null;
  const icao = taf.icaoId || 'endpoint';

  const startHour = Math.floor(nowMs / 3600_000) * 3600_000;
  const out = [];

  for (let h = 0; h < hours; h++) {
    const t = startHour + h * 3600_000;
    const covering = (f) => f.timeFrom * 1000 <= t && t < f.timeTo * 1000;

    const bases = fcsts.filter((f) => !isOverlay(f) && covering(f));
    if (!bases.length) continue; // never invent data for uncovered hours
    const base = bases[bases.length - 1]; // last in-effect base period wins (FM/BECMG in effect from timeFrom)

    let cond = periodConditions(base);
    fcsts.filter((f) => isOverlay(f) && covering(f)).forEach((overlay) => {
      cond = worseOf(cond, periodConditions(overlay));
    });

    const category = categoryFromFields(cond.ceilingFt, cond.visibilitySm);
    const reasons = endpointWeatherReasons(icao, { ...cond, category }, STANDARD_MINIMUMS);
    let verdict = 'GO';
    if (reasons.some((r) => r.severity === 'no-go')) verdict = 'NO-GO';
    else if (reasons.some((r) => r.severity === 'marginal')) verdict = 'MARGINAL';

    out.push({ hourIso: new Date(t).toISOString(), category, verdict });
  }

  return out.length ? out : null;
}

module.exports = { buildTimeline, _test: { parseVisib, periodConditions, worseOf, isOverlay } };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test test/timeline.test.js`
Expected: PASS. If a test fails on hour indexing, re-check the fixture epoch math before touching the algorithm (fixture hours: base 00–05, FM from 06:00Z = 1751781600, TEMPO 08:00–12:00Z = 1751788800–1751803200).

- [ ] **Step 6: Verify live TAF shape**

Run: `curl -s "https://aviationweather.gov/api/data/taf?ids=KORD&format=json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d[0]['fcsts'][0], indent=2))"`
Expected: fields `timeFrom`, `timeTo`, `fcstChange`, `wspd`, `wgst`, `visib`, `clouds[].cover`, `clouds[].base` present. If names differ, update parser + fixture to the real shape and re-run tests.

- [ ] **Step 7: Commit**

```bash
git add api/_timeline.js test/timeline.test.js test/fixtures/taf-kord.json
git commit -m "feat: TAF departure-window timeline with pessimistic TEMPO/PROB merge"
```

---

### Task 4: Wire timeline into the briefing payload

**Files:**
- Modify: `api/briefing.js`

**Interfaces:**
- Consumes: `buildTimeline` from `./_timeline`.
- Produces: payload gains `timeline: { departure: [...]|null, destination: [...]|null } | null` (null overall if both endpoints are null).

- [ ] **Step 1: Implement**

In `api/briefing.js`, add at top: `const { buildTimeline } = require('./_timeline');`

After the `verdictResult` computation from Task 2, add:

```js
    const nowMs = Date.now();
    const depTimeline = buildTimeline(departureTaf, nowMs);
    const destTimeline = buildTimeline(destinationTaf, nowMs);
    const timeline = (depTimeline || destTimeline) ? { departure: depTimeline, destination: destTimeline } : null;
```

Add `timeline,` to the `output` object (next to `verdict` and `factors`).

- [ ] **Step 2: Run the full suite**

Run: `bun test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add api/briefing.js
git commit -m "feat: include departure-window timeline in briefing payload"
```

---

### Task 5: AI narrative via Vercel AI Gateway (verdict-aware, contradiction-guarded)

**Files:**
- Modify: `api/briefing.js`
- Test: `test/briefing.test.js` (append)

**Interfaces:**
- Consumes: existing `AiBriefingSchema`, `maybeTranslateWithAnthropic` call site; `verdictResult` from Task 2.
- Produces: `maybeTranslateWithGateway(payload, verdictResult)` replacing `maybeTranslateWithAnthropic`; `_test` gains `contradictsVerdict(text, verdict) -> bool`; schema gains `verdictExplanation`; payload gains `verdictExplanation` inside the existing `routeSummary`/AI fields flow.

**Gateway grounding step (do this FIRST):** the exact endpoint and model slug must be copied from plaincast's working production pattern, not guessed. Run:
`grep -rn "ai-gateway" ~/plaincast --include="*.js" -l && grep -rn "ai-gateway\|AI_GATEWAY\|haiku" ~/plaincast/api/*.js | head -20`
(If `~/plaincast` doesn't exist: `gh api repos/notjbg/plaincast/contents/api --jq '.[].name'` then fetch the relevant file with `gh api repos/notjbg/plaincast/contents/api/<file> --jq .content | base64 -d`.)
Mirror plaincast's endpoint URL, auth header, model slug, and request shape EXACTLY. The code below assumes the Anthropic-compatible shape (`https://ai-gateway.vercel.sh/v1/messages`, `Authorization: Bearer`, model `anthropic/claude-haiku-4.5`) — if plaincast differs, plaincast wins; adjust and note it in the task report.

- [ ] **Step 1: Write the failing tests**

Append to `test/briefing.test.js`:

```js
describe('contradictsVerdict', () => {
  const { contradictsVerdict } = _test;
  it('flags go-language against a NO-GO verdict', () => {
    expect(contradictsVerdict('Conditions look great, you are good to go today.', 'NO-GO')).toBe(true);
    expect(contradictsVerdict('It is a go for this flight.', 'NO-GO')).toBe(true);
  });
  it('flags no-go language against a GO verdict', () => {
    expect(contradictsVerdict('I would not fly today, this is a no-go.', 'GO')).toBe(true);
  });
  it('passes consistent narrative', () => {
    expect(contradictsVerdict('Ceilings are low; the verdict is NO-GO because of IFR conditions.', 'NO-GO')).toBe(false);
    expect(contradictsVerdict('Clear skies and light winds support the GO verdict.', 'GO')).toBe(false);
  });
  it('passes empty/absent text', () => {
    expect(contradictsVerdict('', 'GO')).toBe(false);
    expect(contradictsVerdict(null, 'NO-GO')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/briefing.test.js`
Expected: FAIL — `contradictsVerdict` undefined.

- [ ] **Step 3: Implement**

In `api/briefing.js`, extend the zod schema:

```js
const AiBriefingSchema = z.object({
  routeSummary: z.string().optional(),
  verdictExplanation: z.string().optional(),
  departureMetar: z.string().optional(),
  departureTaf: z.string().optional(),
  destinationMetar: z.string().optional(),
  destinationTaf: z.string().optional(),
  afdSummary: z.string().optional()
}).passthrough();
```

Add the contradiction guard:

```js
const GO_PHRASES = /\b(good to go|it'?s a go\b|go for (this|the) flight|clear to fly|great day to fly)\b/i;
const NOGO_PHRASES = /\b(no.?go|do not fly|would not fly|don'?t fly|stay on the ground|cancel (the|this) flight)\b/i;

function contradictsVerdict(text, verdict) {
  if (!text) return false;
  if (verdict === 'NO-GO' || verdict === 'INSUFFICIENT DATA') return GO_PHRASES.test(text) && !NOGO_PHRASES.test(text);
  if (verdict === 'GO') return NOGO_PHRASES.test(text) && !GO_PHRASES.test(text);
  return false;
}
```

Replace `maybeTranslateWithAnthropic` with `maybeTranslateWithGateway` (same skeleton — timeout, response parse, JSON extraction, zod validation — with these changes):

```js
let _apiKeyWarned = false;

async function maybeTranslateWithGateway(payload, verdictResult) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    if (!_apiKeyWarned) {
      console.warn('briefcast.config.missing_key', 'AI_GATEWAY_API_KEY not set — AI narratives disabled. Deterministic verdict still active.');
      _apiKeyWarned = true;
    }
    return null;
  }

  const prompt = `You are an aviation weather briefer explaining conditions to a VFR private pilot in plain English.

A deterministic system has already computed the go/no-go verdict. Your job is to EXPLAIN it — you must NEVER contradict it, soften it, or issue your own go/no-go decision.

VERDICT: ${verdictResult.verdict}
REASONS: ${verdictResult.reasons.map((r) => `- [${r.severity}] ${r.text}`).join('\n')}

Return strict JSON with keys: routeSummary, verdictExplanation, departureMetar, departureTaf, destinationMetar, destinationTaf, afdSummary.
- verdictExplanation: 2-3 sentences explaining WHY the verdict is ${verdictResult.verdict}, in plain English, referencing the reasons above.
- The other keys: plain-English translations of the corresponding raw data. Never invent data not present below.

Data:
${JSON.stringify(payload)}`;

  // ... identical AbortController/timeout/fetch skeleton as the old function, but:
  //   URL:     https://ai-gateway.vercel.sh/v1/messages        (or plaincast's exact URL)
  //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'anthropic-version': '2023-06-01' }
  //   body:    { model: 'anthropic/claude-haiku-4.5', max_tokens: 800, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }
  //            (model slug: whatever plaincast uses for Haiku 4.5)
  // ... identical JSON-extraction + AiBriefingSchema.parse tail, then before returning:

  //   const parsed = AiBriefingSchema.parse(...);
  //   const combined = [parsed.routeSummary, parsed.verdictExplanation].filter(Boolean).join(' ');
  //   if (contradictsVerdict(combined, verdictResult.verdict)) {
  //     console.warn('briefcast.ai_contradiction_discarded', { verdict: verdictResult.verdict });
  //     return null;
  //   }
  //   return parsed;
}
```

(The commented skeleton above shows deltas only because the executor is editing the existing function in place — every line of the old fetch/timeout/parse structure stays except URL, headers, body, model, and the guard tail. Write it out fully in the file.)

Update the call site: `ai = await maybeTranslateWithGateway(aiInput, verdictResult);` and add `verdictExplanation: ai?.verdictExplanation || null` to the `output.verdict` object:

```js
      verdict: { ...verdictResult, minimums: STANDARD_MINIMUMS, explanation: ai?.verdictExplanation || null },
```

Remove all references to `ANTHROPIC_API_KEY` from `api/briefing.js` and update the README env-var table: `AI_GATEWAY_API_KEY` (optional) replaces `ANTHROPIC_API_KEY`.

Extend `_test`: add `contradictsVerdict`.

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/briefing.js test/briefing.test.js README.md
git commit -m "feat: verdict-aware AI narrative via Vercel AI Gateway with contradiction guard"
```

---

### Task 6: Frontend — verdict hero, personal minimums, advisory line

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `window.BriefcastVerdict` (`computeVerdict`, `STANDARD_MINIMUMS`) via `<script src="/verdict.js"></script>` added in `<head>` area (before the main inline script, non-defer, or defer both and keep order); payload fields `verdict`, `factors`, `timeline` from `/api/briefing`.
- Produces: rendered verdict hero + minimums editor + advisory line at the top of the results section; localStorage key `briefcast.personalMinimums` (JSON `{ ceilingFt, visibilitySm, windKt, gustKt }`).

**Design language:** reuse the existing card idiom (`<section class="card">`, `.section-kicker`, existing CSS custom properties like `var(--muted)`). Verdict colors as CSS classes on the hero card: `.verdict-go` (green), `.verdict-marginal` (amber), `.verdict-no-go` (red), `.verdict-insufficient` (gray) — define with both light and dark theme values consistent with the page's existing theme toggle. All dynamic strings go through the existing `escapeHtml` helper.

- [ ] **Step 1: Add script tag + CSS**

In `<head>`, next to the existing script tags: `<script src="/verdict.js"></script>` (plain, no defer — the engine must exist before the inline script runs; the inline script is at end of body so plain is safe).

Add CSS (in the existing `<style>` block, near the card styles):

```css
.verdict-hero { border-width: 2px; }
.verdict-hero .verdict-word { font-size: 2.2rem; font-weight: 800; letter-spacing: 0.02em; margin: 4px 0 2px; }
.verdict-go { border-color: #1a7f37; } .verdict-go .verdict-word { color: #1a7f37; }
.verdict-marginal { border-color: #b58105; } .verdict-marginal .verdict-word { color: #b58105; }
.verdict-no-go { border-color: #c62828; } .verdict-no-go .verdict-word { color: #c62828; }
.verdict-insufficient { border-color: #6b7280; } .verdict-insufficient .verdict-word { color: #6b7280; }
.reason-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.reason-chip { font-size: 0.8rem; padding: 3px 10px; border-radius: 999px; border: 1px solid currentColor; }
.reason-chip.sev-no-go, .reason-chip.sev-insufficient { color: #c62828; }
.reason-chip.sev-marginal { color: #b58105; }
.reason-chip.sev-ok { color: #1a7f37; }
.advisory-line { font-size: 0.78rem; color: var(--muted); margin-top: 8px; }
.minimums-editor { display: none; gap: 8px; flex-wrap: wrap; margin-top: 10px; align-items: end; }
.minimums-editor.open { display: flex; }
.minimums-editor label { display: flex; flex-direction: column; font-size: 0.75rem; gap: 2px; }
.minimums-editor input { width: 90px; }
.minimums-tag { font-size: 0.78rem; color: var(--muted); }
```

(If the dark theme uses a class/attribute toggle, add corresponding overrides matching how existing colors are themed — inspect the existing `.stale-banner` and badge styling and follow that pattern.)

- [ ] **Step 2: Implement the JS**

In the inline script, add (near the other helpers):

```js
const MINIMUMS_KEY = 'briefcast.personalMinimums';
const VERDICT_CLASS = { 'GO': 'verdict-go', 'MARGINAL': 'verdict-marginal', 'NO-GO': 'verdict-no-go', 'INSUFFICIENT DATA': 'verdict-insufficient' };

function loadPersonalMinimums() {
  try {
    const raw = localStorage.getItem(MINIMUMS_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    if ([m.ceilingFt, m.visibilitySm, m.windKt, m.gustKt].every((v) => Number.isFinite(v) && v >= 0)) {
      return { ...m, label: 'personal' };
    }
  } catch {}
  return null;
}

function savePersonalMinimums(m) {
  localStorage.setItem(MINIMUMS_KEY, JSON.stringify({ ceilingFt: m.ceilingFt, visibilitySm: m.visibilitySm, windKt: m.windKt, gustKt: m.gustKt }));
}

function clearPersonalMinimums() {
  localStorage.removeItem(MINIMUMS_KEY);
}

function activeVerdict(data) {
  const personal = loadPersonalMinimums();
  if (personal && data.factors && window.BriefcastVerdict) {
    return { result: window.BriefcastVerdict.computeVerdict(data.factors, personal), minimums: personal };
  }
  return { result: { verdict: data.verdict.verdict, reasons: data.verdict.reasons }, minimums: data.verdict.minimums || window.BriefcastVerdict.STANDARD_MINIMUMS };
}

function renderVerdictHero(data) {
  if (!data.verdict) return '';
  const { result, minimums } = activeVerdict(data);
  const cls = VERDICT_CLASS[result.verdict] || 'verdict-insufficient';
  const chips = result.reasons.map((r) =>
    `<span class="reason-chip sev-${escapeHtml(r.severity)}">${escapeHtml(r.text)}</span>`
  ).join('');
  const minsLabel = minimums.label === 'personal'
    ? `Using your personal minimums — ceiling ${minimums.ceilingFt.toLocaleString()} ft, vis ${minimums.visibilitySm} sm, wind ${minimums.windKt} kt, gusts ${minimums.gustKt} kt`
    : `Using standard conservative VFR minimums — ceiling ${minimums.ceilingFt.toLocaleString()} ft, vis ${minimums.visibilitySm} sm, wind ${minimums.windKt} kt, gusts ${minimums.gustKt} kt`;
  const explanation = data.verdict.explanation
    ? `<p class="sans">${escapeHtml(data.verdict.explanation)} <span class="meta">(AI-generated explanation of the deterministic verdict)</span></p>`
    : '';
  const m = minimums;
  return `
    <section class="card verdict-hero ${cls}">
      <p class="section-kicker">Go / No-Go</p>
      <p class="verdict-word">${escapeHtml(result.verdict)}</p>
      <div class="reason-chips">${chips}</div>
      ${explanation}
      <p class="minimums-tag">${minsLabel} · <a href="#" id="editMinimumsLink">Edit minimums</a></p>
      <form class="minimums-editor" id="minimumsEditor">
        <label>Ceiling (ft)<input type="number" id="minCeiling" min="0" step="100" value="${m.ceilingFt}"></label>
        <label>Visibility (sm)<input type="number" id="minVis" min="0" step="1" value="${m.visibilitySm}"></label>
        <label>Wind (kt)<input type="number" id="minWind" min="0" step="1" value="${m.windKt}"></label>
        <label>Gusts (kt)<input type="number" id="minGust" min="0" step="1" value="${m.gustKt}"></label>
        <button class="btn btn-primary" type="submit">Save</button>
        <button class="btn" type="button" id="resetMinimums">Reset to standard</button>
      </form>
      <p class="advisory-line">Advisory only — not an official weather briefing. Pilots must comply with 14 CFR 91.103. For an official briefing use <a href="https://www.1800wxbrief.com" rel="noopener" target="_blank">1800wxbrief.com</a>.</p>
    </section>`;
}

function wireVerdictHero(data) {
  const link = document.getElementById('editMinimumsLink');
  const editor = document.getElementById('minimumsEditor');
  if (!link || !editor) return;
  link.addEventListener('click', (e) => { e.preventDefault(); editor.classList.toggle('open'); });
  editor.addEventListener('submit', (e) => {
    e.preventDefault();
    savePersonalMinimums({
      ceilingFt: Number(document.getElementById('minCeiling').value),
      visibilitySm: Number(document.getElementById('minVis').value),
      windKt: Number(document.getElementById('minWind').value),
      gustKt: Number(document.getElementById('minGust').value)
    });
    rerenderResults(data); // re-render with personal minimums, no refetch
  });
  document.getElementById('resetMinimums').addEventListener('click', () => {
    clearPersonalMinimums();
    rerenderResults(data);
  });
}
```

Also add the same advisory sentence ("Advisory only — not an official weather briefing. Pilots must comply with 14 CFR 91.103.") as a static `<p class="meta">` line in the existing page footer (the `footer-links` block near line 527).

Integrate with the existing render flow: the existing code builds `els.results.innerHTML` from a template around line 1180. Refactor minimally so the full-results render lives in a function `rerenderResults(data)` that (a) prepends `renderVerdictHero(data)` output BEFORE the existing "Quick Look" card, (b) calls `wireVerdictHero(data)` after setting innerHTML, and (c) keeps the last payload in a module-scope `let lastBriefingData` so minimums edits re-render without refetching. Do not restructure the rest of the render template.

- [ ] **Step 3: Manual verification**

Run: `bunx serve public` won't exercise the API — instead run `vercel dev` if available, or verify against prod data by temporarily pasting a captured `/api/briefing` JSON into the console: `rerenderResults(capturedPayload)`. Check: hero renders with correct color class for a NO-GO payload; editing minimums to ceiling 1000/vis 3 flips an MVFR NO-GO to MARGINAL instantly without a network request (Network tab); reload preserves personal minimums; "Reset to standard" reverts; advisory line always visible.

- [ ] **Step 4: Run the full suite (no regressions)**

Run: `bun test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: verdict hero with personal minimums editor and 14 CFR 91.103 advisory"
```

---

### Task 7: Frontend — timeline strip + data-age stamps

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `data.timeline` (`{ departure: [{hourIso, category, verdict}]|null, destination: ... }|null`), existing `data.departure.metar.obsTime` etc., existing `data.stale` handling.
- Produces: timeline strip card rendered between the verdict hero and Quick Look; "observed X min ago" stamps on METAR sections.

- [ ] **Step 1: Add CSS**

```css
.timeline-row { display: flex; align-items: center; gap: 2px; margin: 6px 0; }
.timeline-label { font-size: 0.75rem; width: 46px; color: var(--muted); flex-shrink: 0; }
.timeline-cell { flex: 1; height: 22px; border-radius: 3px; position: relative; min-width: 14px; }
.timeline-cell.v-go { background: #1a7f37; }
.timeline-cell.v-marginal { background: #b58105; }
.timeline-cell.v-no-go { background: #c62828; }
.timeline-hours { display: flex; gap: 2px; margin-left: 48px; }
.timeline-hour { flex: 1; font-size: 0.65rem; color: var(--muted); text-align: center; min-width: 14px; }
.data-age { font-size: 0.72rem; color: var(--muted); }
```

- [ ] **Step 2: Implement the JS**

```js
const TL_CLASS = { 'GO': 'v-go', 'MARGINAL': 'v-marginal', 'NO-GO': 'v-no-go' };

function timelineCaption(cells) {
  if (!cells || !cells.length) return '';
  const nowV = cells[0].verdict;
  if (nowV === 'GO') {
    const worse = cells.find((c) => c.verdict !== 'GO');
    return worse ? `GO now — deteriorating to ${worse.verdict} around ${hourLabel(worse.hourIso)}` : 'GO throughout the window';
  }
  const better = cells.find((c) => c.verdict === 'GO');
  return better ? `${nowV} now — improving to GO around ${hourLabel(better.hourIso)}` : `${nowV} throughout the window`;
}

function hourLabel(iso) {
  return `${String(new Date(iso).getUTCHours()).padStart(2, '0')}:00Z`;
}

function renderTimelineRow(label, cells) {
  if (!cells) return '';
  const cellsHtml = cells.map((c) =>
    `<div class="timeline-cell ${TL_CLASS[c.verdict] || ''}" title="${escapeHtml(hourLabel(c.hourIso))} — ${escapeHtml(c.category)} / ${escapeHtml(c.verdict)}"></div>`
  ).join('');
  return `<div class="timeline-row"><span class="timeline-label">${escapeHtml(label)}</span>${cellsHtml}</div>`;
}

function renderTimeline(data) {
  const tl = data.timeline;
  if (!tl || (!tl.departure && !tl.destination)) return '';
  const hours = (tl.departure || tl.destination).map((c) => `<span class="timeline-hour">${escapeHtml(hourLabel(c.hourIso).slice(0, 2))}</span>`).join('');
  const caption = timelineCaption(tl.departure || tl.destination);
  return `
    <section class="card">
      <p class="section-kicker">Departure Window · next 12 hours (weather only — hazards not hourly-forecast)</p>
      <p class="sans">${escapeHtml(caption)}</p>
      ${renderTimelineRow('DEP', tl.departure)}
      ${renderTimelineRow('DEST', tl.destination)}
      <div class="timeline-hours">${hours}</div>
    </section>`;
}

function dataAge(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return '';
  return `<span class="data-age">observed ${mins} min ago</span>`;
}
```

Insert `renderTimeline(data)` into `rerenderResults` output directly after the verdict hero. Add `dataAge(data.departure?.metar?.obsTime)` / `dataAge(data.destination?.metar?.obsTime)` next to the existing METAR section headers (find where METAR cards render their titles and append the span). Keep the existing stale banner untouched.

- [ ] **Step 3: Manual verification**

Same approach as Task 6 Step 3. Check: strip renders with colored cells matching the payload; caption reads correctly for improving/deteriorating/flat cases; tooltip on hover shows hour/category/verdict; METAR sections show "observed N min ago"; timeline absent (no card, no error) when payload has `timeline: null`.

- [ ] **Step 4: Run the full suite + commit**

Run: `bun test` → PASS

```bash
git add public/index.html
git commit -m "feat: departure-window timeline strip and data-age stamps"
```

---

### Task 8: Docs, version bump, PR

**Files:**
- Modify: `README.md`, `package.json`

- [ ] **Step 1: Update README**

- Endpoints section: document that `/api/briefing` now returns `verdict`, `factors`, `timeline`.
- Env table: replace `ANTHROPIC_API_KEY` row with `AI_GATEWAY_API_KEY` (Optional — "Enables AI verdict explanations and plain-English translations via Vercel AI Gateway").
- Add a "Go / No-Go verdict" section: 3-4 sentences covering deterministic engine, personal minimums (localStorage), pessimistic degradation, and the advisory disclaimer.

- [ ] **Step 2: Bump version**

In `package.json`: `"version": "1.1.0"`.

- [ ] **Step 3: Full suite, push, PR**

```bash
bun test
git add README.md package.json
git commit -m "docs: verdict-first arc — README and v1.1.0"
git push -u origin notjbg/verdict-first-arc
gh pr create --title "Verdict-first arc: deterministic Go/No-Go, departure-window timeline, AI Gateway narrative (v1.1.0)" --body "$(cat <<'EOF'
## Summary
- Deterministic Go/No-Go verdict engine (`public/verdict.js`), shared server/client, pessimistic on every data gap
- Personal minimums (localStorage, client-side recompute — never touches server cache)
- TAF departure-window timeline with pessimistic TEMPO/PROB merge
- AI narrative migrated to Vercel AI Gateway (claude-haiku-4.5), verdict-aware prompt + contradiction guard
- Verdict hero frontend, timeline strip, data-age stamps, 14 CFR 91.103 advisory throughout

## Owner action required
- Set `AI_GATEWAY_API_KEY` in the briefcast Vercel project (until then: deterministic verdict runs, AI narrative gracefully off)

## Test plan
- [ ] `bun test` green (verdict engine, timeline, factors, contradiction guard suites)
- [ ] Live smoke: `/api/briefing?from=KORD&to=KLAX` returns verdict + timeline
- [ ] Frontend: hero renders, minimums edit recomputes instantly, advisory visible

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR opens against `main`, CI runs green.
