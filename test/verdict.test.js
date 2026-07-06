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
  it('returns nulls for masked wind (/////KT variants)', () => {
    expect(parseWind('KXYZ 041215Z /////KT 10SM')).toEqual({ windKt: null, gustKt: null });
    expect(parseWind('KXYZ 041215Z //////KT 10SM')).toEqual({ windKt: null, gustKt: null });
  });
  it('parses calm wind 00000KT as 0 with no gust', () => {
    expect(parseWind('KXYZ 041215Z 00000KT 10SM')).toEqual({ windKt: 0, gustKt: null });
  });
  it('parses 3-digit gusts', () => {
    expect(parseWind('KXYZ 041215Z 24010G105KT 10SM')).toEqual({ windKt: 10, gustKt: 105 });
  });
  it('takes the first wind match and does not double-match a PK WND token in RMK', () => {
    expect(parseWind('KORD 060251Z 02009KT 10SM RMK AO2 PK WND 36032/1645')).toEqual({ windKt: 9, gustKt: null });
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

  it('INSUFFICIENT DATA when a dataOk flag is absent (undefined), not just false', () => {
    // departureMetar key absent → must be treated as missing, IFR weather rules must NOT rescue a GO
    const r = computeVerdict(factors({ category: 'IFR', ceilingFt: 500 }, {}, {}, { departureMetar: undefined }), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('INSUFFICIENT DATA');
    expect(r.reasons.map((x) => x.code)).toContain('missing_metar');
  });

  it('INSUFFICIENT DATA with TWO missing_metar reasons when dataOk is entirely absent', () => {
    const r = computeVerdict({ departure: { ...CLEAR, name: 'KORD' }, destination: { ...CLEAR, name: 'KLAX' } }, STANDARD_MINIMUMS);
    expect(r.verdict).toBe('INSUFFICIENT DATA');
    expect(r.reasons.filter((x) => x.code === 'missing_metar')).toHaveLength(2);
  });

  it('INSUFFICIENT DATA when an endpoint METAR is present but unparseable (category UNKNOWN, null ceiling/vis)', () => {
    // A degraded AUTO METAR whose ceiling and visibility masked out → dataOk true but no VFR judgment possible.
    const unparseable = { category: 'UNKNOWN', ceilingFt: null, visibilitySm: null, windKt: 0, gustKt: null };
    const r = computeVerdict(factors(unparseable, {}, {}, {}), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('INSUFFICIENT DATA');
    const unp = r.reasons.filter((x) => x.code === 'unparseable_metar');
    expect(unp).toHaveLength(1);
    expect(unp[0].text).toContain('KORD');
  });

  it('does NOT flag a normal no-ceiling endpoint (null ceiling but numeric visibility → VFR)', () => {
    // Clear skies: ceiling null, visibility 10, category VFR. Must remain GO.
    const r = computeVerdict(factors({ ceilingFt: null, visibilitySm: 10, category: 'VFR' }), STANDARD_MINIMUMS);
    expect(r.verdict).toBe('GO');
    expect(r.reasons.map((x) => x.code)).not.toContain('unparseable_metar');
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
