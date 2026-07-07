// Pure, dependency-free helpers for the OG share-card endpoint (api/og.jsx).
// Extracted to CJS so they are unit-testable without the edge runtime that
// @vercel/og requires. api/og.jsx imports these — this file is the single
// source of truth for validation + card-data selection.

// Verdict → stamp color. Hexes are the LIGHT-mode stamp tokens from the design
// spec table (docs/superpowers/specs/2026-07-06-flight-strip-arc-design.md).
// Hardcoding is correct here: @vercel/og has no CSS custom properties.
const STAMP_HEX = {
  GO: '#1F7A3D',
  MARGINAL: '#B07C10',
  'NO-GO': '#B3261E',
  'INSUFFICIENT DATA': '#5F6368'
};

const INSUFFICIENT_HEX = STAMP_HEX['INSUFFICIENT DATA'];

// Accepts a raw from/to pair. Codes are 3-4 alphanumerics (ICAO KAUS / IATA AUS),
// case-insensitive. Returns { ok, from, to } with UPPER-cased codes when valid.
// Never trusts these to be real airports — that is the briefing pipeline's job.
const CODE_RE = /^[A-Za-z0-9]{3,4}$/;

function validateCodes(from, to) {
  const f = String(from == null ? '' : from).trim();
  const t = String(to == null ? '' : to).trim();
  if (!CODE_RE.test(f) || !CODE_RE.test(t)) return { ok: false, from: null, to: null };
  return { ok: true, from: f.toUpperCase(), to: t.toUpperCase() };
}

// Given a briefing payload (the /api/briefing JSON) plus the validated codes,
// select exactly what the card renders. Degrades to INSUFFICIENT DATA styling
// on any missing/garbled payload — never throws.
function selectCardData(payload, from, to) {
  const route = `${String(from || '').toUpperCase()} → ${String(to || '').toUpperCase()}`;

  const rawVerdict = payload && payload.verdict && payload.verdict.verdict;
  const verdict = Object.prototype.hasOwnProperty.call(STAMP_HEX, rawVerdict)
    ? rawVerdict
    : 'INSUFFICIENT DATA';
  const stampHex = STAMP_HEX[verdict] || INSUFFICIENT_HEX;

  const reasonList = payload && payload.verdict && Array.isArray(payload.verdict.reasons)
    ? payload.verdict.reasons
    : [];
  const reasons = reasonList
    .map((r) => (r && typeof r.text === 'string' ? r.text.trim() : ''))
    .filter(Boolean)
    .slice(0, 3);

  const generatedAt = payload && typeof payload.generatedAt === 'string' ? payload.generatedAt : null;

  return { verdict, stampHex, reasons, route, generatedAt };
}

// Format an ISO timestamp as a compact Zulu stamp: "061530Z" (DDHHMMZ).
// Returns null for unparseable input so the caller can omit the line.
function formatZulu(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}Z`;
}

module.exports = { STAMP_HEX, validateCodes, selectCardData, formatZulu };
