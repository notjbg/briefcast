# BriefCast Flight Strip Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin briefcast as the Flight Strip identity (paper/ink/stamp), add a route map strip, permalinks, and OG share cards.

**Architecture:** Pure restyle of the single-file frontend around a binding token system (Tasks 1-3, no logic changes); then additive features: geo helpers + map payload (server), Leaflet map strip (client), permalink wiring, `@vercel/og` share endpoint.

**Tech Stack:** Vanilla single-file HTML/CSS/JS (zero build), Google Fonts, Leaflet CDN, Vercel serverless CJS, `@vercel/og`, `bun test`.

## Global Constraints

- **Design tokens are law.** Every color and typeface comes from the spec's token table (`docs/superpowers/specs/2026-07-06-flight-strip-arc-design.md`). No hex value or font family may appear in new CSS unless it is in that table (or derived rgba() of a token). Copy the CSS custom property names exactly: `--paper --strip --ink --ink-soft --rule --bay-blue --stamp-go --stamp-caution --stamp-nogo --stamp-insufficient`.
- Sharp corners on strips (border-radius 0). The ONLY rounded element is the stamp's rounded-rect rings.
- Dark mode via the existing `[data-theme="dark"]` mechanism; every new color themed both ways using the spec's night-ops values.
- Zero frontend build step; no frontend npm deps (Leaflet via CDN, lazy-injected). `@vercel/og` is server-only.
- NO functional changes to verdict/timeline/AI logic in Tasks 1-3 (restyle only — the 110-test suite must pass unchanged, and payload consumption must not change).
- `prefers-reduced-motion: reduce` disables the stamp animation. Keyboard focus visible (`--bay-blue` ring).
- All dynamic strings through the existing `escapeHtml`.
- Verdicts/categories are NEVER trusted from query params server-side ( /api/og recomputes).
- Branch `notjbg/flight-strip-arc`; run `bun test` from repo root; existing 110 tests stay green throughout.
- Copy register: ops-laconic, sentence case body, uppercase display labels, no exclamation marks.

## File Structure

- Modify: `public/index.html` (Tasks 1, 2, 3, 5, 6 — restyle + map + permalinks)
- Create: `api/_geo.js` (great-circle + map payload builder), `test/geo.test.js`
- Modify: `api/briefing.js` (map payload field; Task 4)
- Create: `api/og.jsx` (`@vercel/og` card; Task 7), `test/og.test.js` (validation helpers)
- Delete: `api/oidc-probe.js` (Task 7)
- Modify: `README.md`, `package.json` (Task 8)

---

### Task 1: Foundation restyle — tokens, type, strip bay

**Files:** Modify `public/index.html` (CSS block + structural chrome only)

**Interfaces:**
- Produces: CSS custom properties (token names above) on `:root` and `[data-theme="dark"]`; classes `.strip` (replaces visual role of `.card`), `.strip-rail` (4px left rail, default `--bay-blue`), `.strip-label` (Barlow Condensed uppercase section label, replaces `.section-kicker` styling), `.mono` (Plex Mono data), utility kept backward-compatible: existing class NAMES stay in the markup (`.card`, `.section-kicker`) — restyle them rather than renaming everywhere, adding new classes only where needed. Later tasks (2,3,5) rely on the tokens and `.strip-label`.

- [ ] **Step 1:** Add Google Fonts `<link>` (Barlow Condensed 600;700, IBM Plex Mono 400;600, IBM Plex Sans 400;600, `display=swap`) and font-family stacks with fallbacks (`Arial Narrow`/`ui-monospace`/`system-ui`).
- [ ] **Step 2:** Replace the page's existing color system with the token table (light + dark), keeping the `[data-theme="dark"]` toggle wiring untouched. Page bg `--paper`, cards→strips: `--strip` surface, 1px `--rule` border, radius 0, 4px left rail. Masthead: "BRIEFCAST" in Barlow Condensed 700 uppercase with a mono Zulu clock (`0351Z · 06 JUL` format, client-rendered, updates per render not per second).
- [ ] **Step 3:** Route header form → strip fields: DEP/DEST inputs in Plex Mono uppercase with underline rules inside ruled sub-boxes, swap button as a plain ink glyph button, "Generate briefing" as an ink-on-paper bordered action (no gradients, no shadows). Footer restyled quiet (`--ink-soft`, hairline top rule). Keep combobox behavior intact.
- [ ] **Step 4:** Verify: `bun test` green (no logic change); parse-check inline script via `new Function`; screenshot light+dark via the deployed preview later (Task 8 gate) — for now trace-render key sections in the report.
- [ ] **Step 5:** Commit `feat: flight-strip foundation — tokens, type, strip bay chrome`.

### Task 2: The stamp — verdict strip restyle + press animation

**Files:** Modify `public/index.html`

**Interfaces:**
- Consumes: tokens + `.strip-label` from Task 1; existing `renderVerdictHero(data)` / `wireVerdictHero` / `activeVerdict` functions (KEEP their logic and localStorage behavior byte-identical — restyle output HTML/CSS only).
- Produces: `.stamp` component markup inside the verdict strip; `.stamp-press` animation class.

Stamp CSS (binding starting point — tune values, keep the construction):

```css
.stamp {
  display: inline-block; padding: 10px 26px; position: relative;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700; font-size: 2.4rem; letter-spacing: 0.09em; text-transform: uppercase;
  border: 3px solid currentColor; border-radius: 10px;
  transform: rotate(-2.5deg);
  -webkit-mask-image: radial-gradient(ellipse at 42% 58%, #000 62%, rgba(0,0,0,0.82) 78%, rgba(0,0,0,0.68) 100%);
          mask-image: radial-gradient(ellipse at 42% 58%, #000 62%, rgba(0,0,0,0.82) 78%, rgba(0,0,0,0.68) 100%);
}
.stamp::after { /* inner ring */
  content: ''; position: absolute; inset: 4px;
  border: 1px solid currentColor; border-radius: 6px;
}
@keyframes stamp-press {
  0% { opacity: 0; transform: scale(1.18) rotate(-1deg); }
  100% { opacity: 1; transform: scale(1) rotate(-2.5deg); }
}
.stamp-press { animation: stamp-press 280ms cubic-bezier(0.2, 0.9, 0.3, 1) both; }
@media (prefers-reduced-motion: reduce) { .stamp-press { animation: none; } }
```

- [ ] **Step 1:** Restyle `renderVerdictHero` output: verdict strip with rail colored by verdict (`--stamp-*`), stamp in `color: var(--stamp-*)`, GO shows "GO", NO-GO shows "NO-GO", MARGINAL "MARGINAL", INSUFFICIENT DATA "INSUFF DATA" on the stamp with the full phrase in the strip label. Reason chips → mono ink annotations: `IBM Plex Mono 0.78rem`, `--ink-soft`, prefixed `▸ `, one per line (no pills). Minimums line + editor keep function, restyled as strip fields. Advisory line stays verbatim, `--ink-soft`.
- [ ] **Step 2:** Apply `.stamp-press` on each fresh briefing render (re-add the class so re-generates re-press; use `requestAnimationFrame` re-trigger).
- [ ] **Step 3:** Verify all four verdict states by tracing `renderVerdictHero` with fixture payloads (paste NO-GO + INSUFFICIENT HTML in report); `bun test` green; parse-check.
- [ ] **Step 4:** Commit `feat: stamped clearance verdict with press animation`.

### Task 3: Data strips — raw/decoded interleave, timeline bay, print

**Files:** Modify `public/index.html`

**Interfaces:** Consumes tokens; existing render functions for METAR/TAF/AFD/hazards/PIREPs/timeline (logic untouched).

- [ ] **Step 1:** Raw METAR/TAF blocks → Plex Mono on faint ruled background (`--paper` inset with `--rule` top/bottom); decoded English (AI translations when present) in Plex Sans directly beneath each raw block. AFD/hazards/PIREPs strips get severity rails (hazards strip rail = `--stamp-caution` when non-empty, `--rule` when empty).
- [ ] **Step 2:** Timeline restyle: square cells, mono hour labels, cells use `--stamp-*` fills + `v-empty` as diagonal-hatch (CSS repeating-linear-gradient of `--rule`); keep the fixed-slot grid logic byte-identical.
- [ ] **Step 3:** Print stylesheet pass: strips print with borders, stamp prints in color, map/actions hidden (`no-print`), page fits ~2 pages for a typical briefing.
- [ ] **Step 4:** `bun test` green; parse-check; trace-render sample in report. Commit `feat: data strips, timeline bay, print pass`.

### Task 4: Geo helpers + map payload (TDD)

**Files:** Create `api/_geo.js`, `test/geo.test.js`; modify `api/briefing.js`

**Interfaces:**
- Produces: `greatCircle(from, to, n = 32) -> [[lat, lon] × (n+1)]` (spherical interpolation between `{lat, lon}` points, inclusive endpoints; antimeridian-safe for CONUS routes — document limitation); `buildMapPayload({ airportFrom, airportTo, fromCode, toCode, depCategory, destCategory, sigmets, airmets }) -> { from: {icao, lat, lon, category}, to: {...}, route: [[lat,lon]...], hazardPolygons: [{kind, coords}] } | null` (null when either airport unknown).
- Hazard polygons: from airsigmet items with parseable geometry (`coords` array of `{lat, lon}` or GeoJSON-ish — inspect one live airsigmet response and parse what's actually there; skip items with no/malformed geometry, never throw). `kind`: 'convective' when the Task-2 `isConvective` logic matches (require it from briefing via `_test` or duplicate the 3-line check — prefer exporting `isConvective` from briefing.js `_test` into a shared spot: move `isConvective` into `api/_geo.js` and re-import in briefing.js to avoid duplication).
- `api/briefing.js`: payload gains `map: buildMapPayload(...)` computed alongside `factors` (cached with payload).
- Tests: greatCircle endpoints exact + midpoint sanity (KAUS→KABQ midpoint within 1° of (32.6, -103.4)); n+1 points; buildMapPayload null on unknown airport; hazard polygon parsing from a fixture copied from a REAL airsigmet response; malformed geometry skipped.

- [ ] Steps: failing tests → implement → `bun test` green → commit `feat: great-circle geo helpers and map payload`.

### Task 5: Route map strip (frontend)

**Files:** Modify `public/index.html`

**Interfaces:** Consumes `data.map` (Task 4 shape); tokens.

- [ ] **Step 1:** Map strip renders between timeline and route summary when `data.map` present: `<div id="routeMap">` (height ~300px). Leaflet lazy-load: inject CDN `<link>`+`<script>` (unpkg leaflet@1.9.x with SRI hashes) on first map render; init after script load; subsequent renders reuse. `data.map` absent/Leaflet load failure → no strip, no error (guard + try/catch, log to console only).
- [ ] **Step 2:** Layers: OSM tiles with `filter: grayscale(1) contrast(1.05)` (dark mode: standard invert filter `invert(1) hue-rotate(180deg) brightness(0.9) grayscale(0.4)` on the tile pane); dashed `--bay-blue` polyline over `data.map.route`; circleMarkers at endpoints filled with the flight-category color mapped from `--stamp-*` values (hardcode the hex pairs light/dark from the token table — Leaflet can't read CSS vars in SVG fills reliably; read `getComputedStyle` once instead if simple); mono ICAO tooltips (permanent, small); hazard polygons translucent (`--stamp-caution` fill 0.18 opacity; 'convective' kind uses `--stamp-nogo`). `fitBounds` to route + padding. Attribution kept (OSM requirement).
- [ ] **Step 3:** Re-render behavior: destroy + recreate map on new briefing (`map.remove()`), no leaks. Theme toggle re-applies tile filter (CSS-only, automatic).
- [ ] **Step 4:** `bun test` green; parse-check; report includes trace of injected elements. Commit `feat: route map strip with category endpoints and hazard polygons`.

### Task 6: Permalinks + copy link

**Files:** Modify `public/index.html`

- [ ] **Step 1:** On load: if `?from=` and `?to=` are present and valid-looking codes (`/^[A-Za-z0-9]{3,4}$/`), populate the fields and auto-generate. After any successful generate: `history.replaceState` to `?from=X&to=Y` (uppercased ICAO actually used).
- [ ] **Step 2:** "Copy link" ink-button on the verdict strip: copies `location.origin + '/?from=X&to=Y'` via `navigator.clipboard` (fallback: temporary input + execCommand); confirmation text "Link copied" inline for 2s (no toast library).
- [ ] **Step 3:** `bun test` green; parse-check. Commit `feat: briefing permalinks and copy link`.

### Task 7: OG share card + cleanup (TDD for validation)

**Files:** Create `api/og.jsx`, `test/og.test.js`; delete `api/oidc-probe.js`; modify `public/index.html` (head), `package.json` (dep)

**Interfaces:**
- `bun add @vercel/og` (server dep). `api/og.jsx` exports a Vercel function (edge runtime NOT required; use Node if @vercel/og supports it — check its README via node_modules after install; if edge-only, `export const config = { runtime: 'edge' }` and adapt imports; note the repo is CJS but .jsx OG functions are typically ESM — an isolated ESM file is acceptable HERE ONLY, per @vercel/og's requirements; do not convert anything else).
- Flow: validate `from`/`to` (same normalize rules as briefing — import from `_utils` if runtime allows; if edge runtime can't require the CJS utils, inline a minimal `/^[A-Z0-9]{3,4}$/i` validation and fetch the briefing from own origin instead: `fetch(new URL('/api/briefing?from=..&to=..', req.url))` and render from its payload — this reuses the whole pipeline including cache and never trusts the client).
- Card (1200×630, flight-strip identity): paper bg, BRIEFCAST masthead, route fields `KAUS → KABQ`, the stamp (verdict color, rotated, double ring — inline styles), up to 3 reason texts (mono), `generatedAt` Zulu, advisory line small. Any fetch/render failure → generic branded card (masthead + "Pre-flight briefings in plain English"), HTTP 200, never a 500.
- `public/index.html` head: default `og:image` → `/api/og` (which with no params returns the generic card); when a permalink loads, JS updates the `og:image` meta to the parameterized URL (best-effort; scrapers use the server-rendered default — acceptable, noted).
- Tests (`test/og.test.js`): the code validation helper (exported for test) accepts KAUS/aus/KABQ, rejects `<script>`, empty, 5+ chars; card-data selection helper picks ≤3 reasons and correct stamp color token per verdict. (Rendering itself is not unit-tested — verified live in Task 8.)
- Delete `api/oidc-probe.js`.

- [ ] Steps: failing tests → implement → `bun test` green → commit `feat: OG share card endpoint; remove oidc probe`.

### Task 8: Docs, version, PR, live visual pass

**Files:** Modify `README.md`, `package.json`

- [ ] **Step 1:** README: identity note (Flight Strip), map payload + `/api/og` + permalinks documented; version → `1.2.0`.
- [ ] **Step 2:** Full `bun test`; push; `gh pr create` (title "Flight Strip identity + route map, permalinks, share cards (v1.2.0)", body summarizing per PR-body conventions with the Claude Code attribution footer).
- [ ] **Step 3:** Live visual pass on the Vercel PREVIEW deployment (the PR's preview URL is auth-protected — use `vercel deploy` from the branch and screenshot via the browse/playwright tooling if available to the controller; otherwise the controller does this step): light, dark, print preview, a NO-GO route, `/api/og?from=KAUS&to=KABQ` renders a PNG. Report screenshots/findings.
- [ ] **Step 4:** Commit remaining docs; PR ready.

## Self-Review Notes
- Tokens verbatim from spec ✓; no code-level contradictions between tasks (Tasks 1-3 same file, sequential) ✓; Task 4 exports consumed by 5 named exactly ✓; OG never trusts client verdicts ✓; probe removal covered ✓.
