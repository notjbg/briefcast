const { describe, it, expect } = require('bun:test');
const { buildTimeline } = require('../api/_timeline');
const taf = require('./fixtures/taf-kord.json');

const NOW = 1783296000000; // 2026-07-06T00:00:00Z, aligned with fixture

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
