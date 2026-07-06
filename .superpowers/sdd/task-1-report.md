# Task 1 Report: Verdict engine (`public/verdict.js`)

**Status:** DONE
**Commit:** `30f5a43` — "feat: deterministic Go/No-Go verdict engine (shared server/client)"
**Branch:** notjbg/verdict-first-arc

## What was done

Followed strict TDD per the brief:

1. **Wrote failing tests** — `test/verdict.test.js` verbatim from the brief (parseWind, computeVerdict, endpointWeatherReasons).
2. **Confirmed failure** — `bun test test/verdict.test.js` → `Cannot find module '../public/verdict.js'` (exactly as the brief predicted).
3. **Implemented** — `public/verdict.js` verbatim from the brief. UMD wrapper exposing CommonJS `module.exports` and browser `window.BriefcastVerdict`; dependency-free. Exports `STANDARD_MINIMUMS`, `parseWind`, `endpointWeatherReasons`, `computeVerdict`.
4. **Green** — `bun test test/verdict.test.js` → 17 pass / 0 fail, 35 expect() calls.
5. **Committed** the two files with the brief's exact message.

## Test output summary

- Verdict suite: **17 pass / 0 fail** (35 assertions).
- Full suite (`bun test`): **59 pass / 1 fail / 1 error** across 3 files.
  - The single failure/error is **pre-existing and unrelated**: `test/briefing.test.js` cannot load `api/briefing.js` because package `zod` is not installed (`node_modules/zod` absent). I touched nothing under `api/` and added no dependencies. My two new files are the only additions.

## Deviations from the brief

None. Test file and implementation were used verbatim.

## Self-review notes

- Verdict severity precedence (INSUFFICIENT > NO-GO > MARGINAL > GO) is deterministic and pessimistic: any missing METAR forces INSUFFICIENT DATA even alongside no-go hazards; missing gust data is treated as gust = sustained wind.
- At-minimum/at-limit boundaries use strict `<` / `>`, so ceiling === min and wind === limit correctly pass (verified by tests).
- `endpointWeatherReasons` emits only weather severities (no-go/marginal), no hazard rules — keeping it reusable for the later per-hour timeline (Task 3/4).
- `.gitignore` had an unrelated pre-existing modification in the working tree; left it out of this commit to keep the diff scoped to Task 1.

## Concern to flag for later tasks

The full test suite is red on `main`/branch due to the missing `zod` dependency in `api/briefing.js`. This is not introduced here but will need `bun install` / a zod dependency added before the branch-level suite is fully green (likely surfaces in Task 2, which touches the payload/api layer).

---

## Fix: undefined dataOk flags degrade to INSUFFICIENT DATA (pessimism invariant)

**Date:** 2026-07-05

**Problem:** The missing-METAR trigger used `dataOk.departureMetar === false` and the weather gate used truthiness, so when a `dataOk` flag was `undefined` (key absent), NEITHER fired — no `missing_metar` reason and the endpoint's weather rules were skipped. Reproduced: `dataOk = { destinationMetar: true }` with an IFR ceiling-500 departure returned GO, violating the binding invariant that every data gap degrades pessimistically.

**Change (`public/verdict.js`):** The two missing-METAR triggers now fire whenever `factors?.dataOk?.departureMetar !== true` / `...destinationMetar !== true` — treating false, undefined, and entirely-absent `factors`/`dataOk` as a gap. In the entirely-absent case BOTH endpoints now get a `missing_metar` reason (previously only departure). Weather-evaluation gates left as `=== true` (correct, since non-true now always yields INSUFFICIENT DATA).

**Tests (`test/verdict.test.js`, added first — TDD):**
- `dataOk: { departureMetar: undefined }` with an IFR ceiling-500 departure → `INSUFFICIENT DATA`, reasons include `missing_metar`.
- `computeVerdict({ departure, destination }, STANDARD_MINIMUMS)` with no `dataOk` → `INSUFFICIENT DATA` with TWO `missing_metar` reasons.

**Verification:**
```
$ bun test test/verdict.test.js
 19 pass / 0 fail / 39 expect() calls
$ bun test
 79 pass / 0 fail / 129 expect() calls (3 files)
```

---

## Final-review fix wave (2026-07-05)

**Blocker fixed:** A present-but-unparseable METAR resolved to GO, violating the "every data gap degrades toward caution" invariant. `api/briefing.js` sets `dataOk` from METAR *presence* (`!!rawOb`), not parseability, so a degraded AUTO report (e.g. `KXYZ 041215Z AUTO 00000KT //// // ////// 10/09 A3001 RMK AO2`) parses to `ceilingFt=null, visibilitySm=null` → category `UNKNOWN` → no weather reasons → GO.

**Fix (TDD, `public/verdict.js`):** Added `unparseableMetarReasons(name, ep)`, called from `computeVerdict` for each endpoint whose `dataOk` is true. When `category === 'UNKNOWN' && ceilingFt === null && visibilitySm === null`, it pushes `{ severity: 'insufficient', code: 'unparseable_metar', text: 'METAR for <name> could not be parsed — ceiling and visibility unknown' }`, so severity precedence yields INSUFFICIENT DATA. Wind presence does not rescue it (ceiling+vis unknown = no VFR judgment). Guard lives in `computeVerdict` ONLY — `endpointWeatherReasons` signature/behavior unchanged, so `api/_timeline.js` (which maps UNKNOWN → MARGINAL locally) is unaffected.

**Tests added:** (a) one endpoint unparseable → INSUFFICIENT DATA with `unparseable_metar` naming the endpoint; (b) both clear+parseable → still GO (no regression); (c) null ceiling + numeric visibility (VFR) → NOT flagged. Plus parseWind edge cases: `/////KT` and `//////KT` → nulls; `00000KT` → `{0, null}`; 3-digit gust `24010G105KT` → `{10, 105}`; first-match-wins so a `PK WND` token inside RMK is not double-matched.

**Verification:** `bun test test/verdict.test.js` → 25 pass / 0 fail. Full `bun test` → 110 pass / 0 fail (was 104; +6 new). Timeline tests unchanged and green.
