# BriefCast Flight Strip Arc (Arcs 2+3) — Design

**Date:** 2026-07-06
**Status:** Approved (identity direction chosen by owner: Flight Strip)
**Goal:** Give briefcast its own visual identity — the ATC flight-progress-strip — and ship the two features that make briefings shareable and scannable: a route map and share cards with permalinks.

## Thesis

A briefing IS paperwork. Controllers move paper strips through bays; dispatchers stamp releases. BriefCast's page becomes a strip bay: the route header is a flight strip, every data section is a strip in the bay, and the verdict is a **rubber stamp** pressed onto the paperwork. The stamp is the signature element — everything else stays quiet and disciplined.

## Design tokens (binding — all colors/type derive from these)

### Color — "paper, ink, stamp"
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FAFAF7` | page background (stark strip-white, NOT warm cream) |
| `--strip` | `#FFFFFF` | strip/card surface |
| `--ink` | `#16181B` | primary text (teleprinter ink) |
| `--ink-soft` | `#5C6166` | secondary text, meta |
| `--rule` | `#D8DAD5` | hairline rules, strip borders |
| `--bay-blue` | `#2B5A8A` | structure accent: links, section rail, focus rings (strip-holder blue) |
| `--stamp-go` | `#1F7A3D` | GO stamp + GO timeline cells |
| `--stamp-caution` | `#B07C10` | MARGINAL |
| `--stamp-nogo` | `#B3261E` | NO-GO |
| `--stamp-insufficient` | `#5F6368` | INSUFFICIENT DATA |

Dark mode = "night ops": `--paper #101214`, `--strip #17191C`, `--ink #E8E6E1`, `--ink-soft #9AA0A6`, `--rule #2A2D31`, `--bay-blue #7FAAD4`, stamps brightened (`#34A853`, `#F0A92E`, `#E5544B`, `#9AA0A6`). Existing `[data-theme="dark"]` mechanism unchanged.

### Type
| Role | Face | Delivery |
|---|---|---|
| Display (masthead, stamp, strip labels) | **Barlow Condensed** 600/700, uppercase, tracked +0.06em | Google Fonts `<link>` |
| Data (raw METAR/TAF, times, codes, timeline hours) | **IBM Plex Mono** 400/600 | Google Fonts `<link>` |
| Body (decoded English, narrative) | **IBM Plex Sans** 400/600 | Google Fonts `<link>` |

Font loading: single `<link>` with `display=swap`; system fallbacks (`Arial Narrow`, `ui-monospace`, `system-ui`). Print stylesheet keeps the strip idiom (it already prints briefings — this identity is print-native).

### Layout — the strip bay
- Max-width column (~760px) of full-width horizontal **strips**, each: 1px `--rule` border, 4px left rail colored by content severity (blue = informational, stamp colors = verdict-bearing), sharp corners (0 radius — strips are cut paper), generous internal ruled sub-columns where the content is tabular.
- **Route header strip** (replaces the form card visually): ruled boxes like a real strip — DEP field, arrow, DEST field, time field, GENERATE action. Inputs styled as strip fields (mono, underline-rule, no heavy chrome).
- **Verdict stamp** (signature): double-ring rounded-rect border (3px outer + 1px inner ring), Barlow Condensed 700 uppercase, rotated `-2.5deg`, subtle ink unevenness via a CSS `radial-gradient` mask/opacity texture — must read as stamped, not badged. Sits on the verdict strip with the reason chips (restyled as mono ink annotations, not pills) beneath.
- Timeline: bay of square mono-labeled cells (existing fixed-slot grid logic untouched — restyle only).
- Raw↔decoded: raw METAR/TAF in Plex Mono on a faint ruled background, decoded English in Plex Sans directly beneath — interleaved, never side-by-side tabs.

### Motion (one orchestrated moment)
On briefing render, the stamp "presses": scale 1.18→1.0 + rotate -1deg→-2.5deg + opacity 0→1, 280ms ease-out, once. `prefers-reduced-motion: reduce` → no animation. Nothing else animates beyond existing hover affordances.

### Copy register
Ops-laconic, active voice, sentence case except strip labels (uppercase display). The generate button says "Generate briefing". Errors say what happened and what to do. No exclamation marks anywhere.

## Arc 3 features (designed inside the identity)

### Route map strip
- One strip containing a map: **Leaflet via CDN + OpenStreetMap tiles** (no key, no build step). Lazy-init after briefing render (script injected on first use; map absent = strip absent, never an error).
- Content: great-circle route line (`--bay-blue`, dashed), endpoint markers as flight-category-colored dots (`--stamp-*` colors) with mono ICAO labels, SIGMET/AIRMET polygons (when geometry present in the existing airsigmet payload) as translucent caution/no-go fills.
- Server: `/api/briefing` payload gains `map: { from: {icao, lat, lon, category}, to: {...}, hazardPolygons: [{kind: 'sigmet'|'airmet'|'convective', coords: [[lat,lon]...]}] }` — derived from data already fetched (airports table + airsigmet geometry). No new upstream calls.
- Grayscale tile filter (`filter: grayscale(1) contrast(1.05)`) so the paper identity holds and category colors pop; dark mode inverts tiles (standard Leaflet dark CSS filter trick).

### Permalinks + share cards
- **Permalink:** `?from=KAUS&to=KABQ` auto-generates the briefing on load; generating updates the URL via `history.replaceState`. "Copy link" affordance on the verdict strip.
- **Share card:** `GET /api/og?from=X&to=Y` returns a 1200×630 PNG via `@vercel/og` (new server-only dependency; allowed — zero frontend build impact). The card is a rendered flight strip: masthead, route fields, the stamp (correct color), 2-3 reason lines, timestamp, disclaimer line. **Verdict recomputed server-side** (reuse the briefing pipeline's cached fetch + `computeVerdict`) — never trusted from query params. Cached `s-maxage=300` to match briefing TTL. Page `<head>` gets `og:image` pointing at `/api/og?from&to` (only meaningful when a permalink is shared — head tags updated client-side AND the default og:image stays for the bare URL).
- Failure: `/api/og` on any upstream failure returns a generic branded card (no verdict), never a 500 image.

### Cleanup
- Remove the temporary `/api/oidc-probe` endpoint.

## Out of scope
Launch/marketing push (next arc, after a screenshot-worthy product exists — which is this arc's job). Winds aloft, multi-leg, monetization.

## Error handling
Existing pessimism/fallback behavior untouched — this arc restyles and adds read-only surfaces. Map and OG endpoints degrade to absence/generic, never block the briefing.

## Testing
- `bun test`: new pure helpers only — great-circle point generation (`api/_geo.js`), map payload builder (shape + null-geometry hazards skipped + endpoints require known airports), OG input validation. Existing 110 tests must stay green.
- Visual verification: screenshot pass on the deployed preview (light + dark + print + reduced-motion trace), stamped verdict at all four states.

## Delivery
Single PR `notjbg/flight-strip-arc`, version 1.2.0. Fable orchestrates + reviews; Opus 4.8 subagents execute.
