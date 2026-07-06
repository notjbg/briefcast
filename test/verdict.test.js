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
