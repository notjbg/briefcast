// OG share-card endpoint — GET /api/og?from=KAUS&to=KABQ → 1200x630 PNG.
//
// Runtime: EDGE. @vercel/og supports both Node and Edge, but Edge is the
// battle-tested target here: fonts load via `import.meta.url` asset tracing and
// the own-origin briefing self-fetch uses the absolute `req.url`. This is the
// ONLY ESM file in the repo (everything else is CJS) — that is intentional and
// allowed for the OG function per @vercel/og's requirements. Do not convert
// other files.
//
// This file uses a tiny hyperscript helper (`h`) instead of JSX syntax: React
// is not a dependency and the repo has no JSX-transform config, so relying on
// the platform bundler's JSX pragma would be fragile. `h` returns plain
// React-element-shaped objects, which Satori/ImageResponse consume directly.
//
// SECURITY: verdict/category are NEVER trusted from query params. We validate
// only that from/to look like airport codes, then fetch our OWN briefing
// endpoint and render from that payload. Any missing/invalid params or ANY
// failure degrades to a generic branded card at HTTP 200 — never a 500 or JSON.

import { ImageResponse } from '@vercel/og';
import { validateCodes, selectCardData, formatZulu } from './_og-data.js';

export const config = { runtime: 'edge' };

// Design tokens (light-mode) hardcoded from the flight-strip spec
// (docs/superpowers/specs/2026-07-06-flight-strip-arc-design.md). @vercel/og has
// no CSS custom properties, so literal hexes are correct here.
const PAPER = '#FAFAF7';
const INK = '#16181B';
const INK_SOFT = '#5C6166';
const RULE = '#D8DAD5';
const BAY_BLUE = '#2B5A8A';

const FONT_DISPLAY = 'Barlow Condensed';
const FONT_MONO = 'IBM Plex Mono';

const CACHE_HEADER = 'public, s-maxage=300, max-age=300';

// Minimal hyperscript: returns a React-element-shaped node Satori understands.
function h(type, props, ...children) {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  const childProp = flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat;
  return { type, props: { ...(props || {}), ...(childProp !== undefined ? { children: childProp } : {}) } };
}

async function loadFont(path) {
  const res = await fetch(new URL(path, import.meta.url));
  if (!res.ok) throw new Error(`font fetch failed: ${path}`);
  return res.arrayBuffer();
}

// Returns the fonts array for ImageResponse, or [] on any failure (Satori then
// falls back to its bundled Noto Sans — the card still renders at 200).
async function loadFonts() {
  try {
    const [semi, bold, mono] = await Promise.all([
      loadFont('../public/fonts/BarlowCondensed-SemiBold.ttf'),
      loadFont('../public/fonts/BarlowCondensed-Bold.ttf'),
      loadFont('../public/fonts/IBMPlexMono-Regular.ttf')
    ]);
    return [
      { name: FONT_DISPLAY, data: semi, weight: 600, style: 'normal' },
      { name: FONT_DISPLAY, data: bold, weight: 700, style: 'normal' },
      { name: FONT_MONO, data: mono, weight: 400, style: 'normal' }
    ];
  } catch {
    return [];
  }
}

function imageResponse(element, fonts) {
  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts,
    headers: { 'cache-control': CACHE_HEADER }
  });
}

// Masthead used by both cards.
function masthead() {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottom: `3px solid ${INK}`,
        paddingBottom: '18px'
      }
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: '64px',
          letterSpacing: '4px',
          color: INK
        }
      },
      'BRIEFCAST'
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: FONT_DISPLAY,
          fontWeight: 600,
          fontSize: '24px',
          letterSpacing: '3px',
          color: BAY_BLUE
        }
      },
      'PRE-FLIGHT WX BRIEFING'
    )
  );
}

// The rubber stamp: double ring (outer 3px + inner 1px), rotated -2.5deg.
function stamp(verdict, stampHex) {
  const long = verdict.length > 8; // "INSUFFICIENT DATA", "MARGINAL"
  return h(
    'div',
    {
      style: {
        display: 'flex',
        transform: 'rotate(-2.5deg)',
        border: `4px solid ${stampHex}`,
        borderRadius: '14px',
        padding: '7px'
      }
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          border: `1px solid ${stampHex}`,
          borderRadius: '9px',
          padding: long ? '20px 30px' : '22px 42px',
          maxWidth: '360px'
        }
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: long ? '44px' : '78px',
            lineHeight: 1.05,
            letterSpacing: '3px',
            color: stampHex
          }
        },
        verdict
      )
    )
  );
}

function verdictCardElement(card) {
  const zulu = formatZulu(card.generatedAt);
  const reasonNodes = card.reasons.map((text, i) =>
    h(
      'div',
      {
        key: i,
        style: {
          display: 'flex',
          fontFamily: FONT_MONO,
          fontWeight: 400,
          fontSize: '26px',
          lineHeight: 1.35,
          color: INK_SOFT,
          marginTop: i === 0 ? '0' : '14px'
        }
      },
      `— ${text}`
    )
  );

  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '1200px',
        height: '630px',
        backgroundColor: PAPER,
        padding: '56px 64px',
        fontFamily: FONT_MONO
      }
    },
    masthead(),
    // Body: route + reasons on the left, stamp on the right.
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexGrow: 1,
          padding: '8px 0'
        }
      },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, paddingRight: '40px' } },
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontFamily: FONT_MONO,
              fontWeight: 400,
              fontSize: '72px',
              letterSpacing: '2px',
              color: INK,
              marginBottom: reasonNodes.length ? '28px' : '0'
            }
          },
          card.route
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column' } }, ...reasonNodes)
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, stamp(card.verdict, card.stampHex))
    ),
    // Footer: timestamp + advisory.
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${RULE}`,
          paddingTop: '18px',
          fontFamily: FONT_MONO,
          fontSize: '20px',
          color: INK_SOFT
        }
      },
      h('div', { style: { display: 'flex' } }, zulu ? `Generated ${zulu}` : 'briefcast.live'),
      h('div', { style: { display: 'flex' } }, 'Not an official weather briefing — verify before flight')
    )
  );
}

function genericCardElement() {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: '1200px',
        height: '630px',
        backgroundColor: PAPER,
        padding: '64px'
      }
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: '120px',
          letterSpacing: '6px',
          color: INK
        }
      },
      'BRIEFCAST'
    ),
    h('div', { style: { display: 'flex', width: '420px', height: '5px', backgroundColor: BAY_BLUE, margin: '24px 0 32px' } }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: FONT_MONO,
          fontWeight: 400,
          fontSize: '38px',
          color: INK_SOFT
        }
      },
      'Pre-flight weather briefings in plain English'
    )
  );
}

export default async function handler(req) {
  let fonts = [];
  try {
    fonts = await loadFonts();
    const url = new URL(req.url);
    const v = validateCodes(url.searchParams.get('from'), url.searchParams.get('to'));
    if (!v.ok) return imageResponse(genericCardElement(), fonts);

    let payload = null;
    try {
      const briefingUrl = new URL(`/api/briefing?from=${v.from}&to=${v.to}`, req.url);
      const resp = await fetch(briefingUrl.toString());
      if (resp.ok) payload = await resp.json();
    } catch {
      payload = null;
    }
    if (!payload) return imageResponse(genericCardElement(), fonts);

    const card = selectCardData(payload, v.from, v.to);
    return imageResponse(verdictCardElement(card), fonts);
  } catch {
    // Absolute last resort — never a 500, never a JSON body.
    try {
      return imageResponse(genericCardElement(), fonts);
    } catch {
      return new Response(null, { status: 200, headers: { 'content-type': 'image/png', 'cache-control': CACHE_HEADER } });
    }
  }
}
