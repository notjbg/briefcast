const { describe, it, expect } = require('bun:test');
const { _test } = require('../api/briefing');
const { summarizeHazards, summarizePireps, selectAfdText, plainRouteSummary, normalizeMetarTimestamps } = _test;

describe('summarizeHazards', () => {
  it('returns empty array with no inputs', () => {
    expect(summarizeHazards()).toEqual([]);
  });

  it('formats SIGMETs', () => {
    const result = summarizeHazards([{ airSigmetId: 'WS1', hazard: 'TURB' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('SIGMET');
    expect(result[0]).toContain('TURB');
  });

  it('formats AIRMETs', () => {
    const result = summarizeHazards([], [{ hazard: 'IFR', phenomenon: 'fog' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('AIRMET');
  });

  it('formats TFRs', () => {
    const result = summarizeHazards([], [], [{ notamId: 'TFR-001', description: 'Presidential airspace' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('TFR');
    expect(result[0]).toContain('Presidential');
  });

  it('limits each category to 5 items', () => {
    const sigmets = Array.from({ length: 10 }, (_, i) => ({ hazard: `SIG${i}` }));
    const result = summarizeHazards(sigmets);
    expect(result).toHaveLength(5);
  });
});

describe('summarizePireps', () => {
  it('returns empty array with no input', () => {
    expect(summarizePireps()).toEqual([]);
    expect(summarizePireps([])).toEqual([]);
  });

  it('formats pilot reports', () => {
    const result = summarizePireps([{ stationId: 'KORD', obsTime: '2100Z', report: 'Moderate turbulence FL250' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('KORD');
    expect(result[0]).toContain('Moderate turbulence');
  });

  it('limits to 10 reports', () => {
    const pireps = Array.from({ length: 20 }, (_, i) => ({ stationId: `K${i}`, report: 'test' }));
    expect(summarizePireps(pireps)).toHaveLength(10);
  });
});

describe('selectAfdText', () => {
  it('returns empty string for empty input', () => {
    expect(selectAfdText('')).toBe('');
    expect(selectAfdText()).toBe('');
  });

  it('extracts .AVIATION block', () => {
    const afd = '.SYNOPSIS...\nSome synopsis text.\n.AVIATION...\nVFR conditions expected.\n.MARINE...\nWaves 2-4 ft.';
    const result = selectAfdText(afd);
    expect(result).toContain('VFR conditions expected');
    expect(result).not.toContain('MARINE');
  });

  it('handles && delimiter', () => {
    const afd = '.AVIATION...\nClear skies with light winds.\n&&\nSome other section.';
    const result = selectAfdText(afd);
    expect(result).toContain('Clear skies');
  });

  it('returns full text when no .AVIATION header', () => {
    const afd = 'General forecast discussion with no aviation section.';
    const result = selectAfdText(afd);
    expect(result).toContain('General forecast');
  });

  it('truncates at 2400 chars', () => {
    const longText = 'A'.repeat(3000);
    const afd = '.AVIATION...\n' + longText + '\n.NEXT...';
    const result = selectAfdText(afd);
    expect(result.length).toBeLessThanOrEqual(2400);
  });
});

describe('plainRouteSummary', () => {
  it('includes from/to codes and categories', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'VFR', 0);
    expect(result).toContain('KORD');
    expect(result).toContain('KLAX');
    expect(result).toContain('VFR');
  });

  it('mentions hazard count when present', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'IFR', 3);
    expect(result).toContain('3');
    expect(result).toContain('hazard');
  });

  it('says no hazards when count is 0 and fetch succeeded', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'VFR', 0, true);
    expect(result).toContain('No active hazard');
  });

  it('shows unavailable message when hazard fetch failed', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'VFR', 0, false);
    expect(result).toContain('temporarily unavailable');
  });
});

describe('normalizeMetarTimestamps', () => {
  it('normalizes upstream unix-second timestamps used by the briefing UI', () => {
    const result = normalizeMetarTimestamps({
      obsTime: 1774803060,
      receiptTime: 1774803256,
      reportTime: 1774803600
    });

    expect(result.obsTime).toBe('2026-03-29T16:51:00.000Z');
    expect(result.receiptTime).toBe('2026-03-29T16:54:16.000Z');
    expect(result.reportTime).toBe('2026-03-29T17:00:00.000Z');
  });
});

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
