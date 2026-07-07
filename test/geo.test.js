const { describe, it, expect } = require('bun:test');
const { greatCircle, isConvective, parseHazardCoords, buildMapPayload } = require('../api/_geo');

// A real AWC airsigmet item shape (coords: [{lat, lon}, ...]), copied from a
// live https://aviationweather.gov/api/data/airsigmet?format=json response.
const REAL_SIGMET = {
  icaoId: 'KKCI',
  airSigmetType: 'SIGMET',
  hazard: 'CONVECTIVE',
  severity: 5,
  coords: [
    { lat: 40.345, lon: -75.988 },
    { lat: 38.026, lon: -74.54 },
    { lat: 37.217, lon: -80.324 },
    { lat: 38.112, lon: -81.12 },
    { lat: 39.855, lon: -79.081 },
    { lat: 40.345, lon: -75.988 }
  ]
};

const KAUS = { icao: 'KAUS', lat: 30.19, lon: -97.67 };
const KABQ = { icao: 'KABQ', lat: 35.04, lon: -106.61 };

describe('greatCircle', () => {
  it('includes both endpoints exactly', () => {
    const pts = greatCircle(KAUS, KABQ, 32);
    expect(pts[0]).toEqual([30.19, -97.67]);
    expect(pts[pts.length - 1]).toEqual([35.04, -106.61]);
  });

  it('returns n+1 points', () => {
    expect(greatCircle(KAUS, KABQ, 32)).toHaveLength(33);
    expect(greatCircle(KAUS, KABQ, 8)).toHaveLength(9);
    expect(greatCircle(KAUS, KABQ, 1)).toHaveLength(2);
  });

  it('midpoint sits on the great circle (within 1° of computed slerp midpoint)', () => {
    // True spherical midpoint of KAUS->KABQ, computed independently: (32.694, -102.019).
    const pts = greatCircle(KAUS, KABQ, 32);
    const mid = pts[16];
    expect(Math.abs(mid[0] - 32.694)).toBeLessThan(1);
    expect(Math.abs(mid[1] - (-102.019))).toBeLessThan(1);
  });

  it('returns [] for missing/non-finite coordinates', () => {
    expect(greatCircle(null, KABQ)).toEqual([]);
    expect(greatCircle(KAUS, null)).toEqual([]);
    expect(greatCircle({ lat: NaN, lon: 0 }, KABQ)).toEqual([]);
  });

  it('handles coincident endpoints without NaN', () => {
    const pts = greatCircle(KAUS, KAUS, 4);
    expect(pts).toHaveLength(5);
    pts.forEach(([lat, lon]) => {
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lon)).toBe(true);
    });
  });
});

describe('isConvective', () => {
  it('matches convective hazard field', () => {
    expect(isConvective(REAL_SIGMET)).toBe(true);
    expect(isConvective({ hazard: 'ICE' })).toBe(false);
    expect(isConvective({ phenomenon: 'TS' })).toBe(true);
  });
});

describe('parseHazardCoords', () => {
  it('parses the real airsigmet coords shape', () => {
    const ring = parseHazardCoords(REAL_SIGMET);
    expect(ring).toHaveLength(6);
    expect(ring[0]).toEqual([40.345, -75.988]);
  });

  it('returns null for missing/malformed geometry', () => {
    expect(parseHazardCoords({})).toBeNull();
    expect(parseHazardCoords({ coords: null })).toBeNull();
    expect(parseHazardCoords({ coords: [{ lat: 'x', lon: 1 }] })).toBeNull();
    expect(parseHazardCoords({ coords: [{ lat: 40 }] })).toBeNull();
  });
});

describe('buildMapPayload', () => {
  const base = {
    airportFrom: KAUS,
    airportTo: KABQ,
    fromCode: 'KAUS',
    toCode: 'KABQ',
    depCategory: 'VFR',
    destCategory: 'MVFR',
    sigmets: [],
    airmets: []
  };

  it('returns null when either airport is unknown', () => {
    expect(buildMapPayload({ ...base, airportFrom: null })).toBeNull();
    expect(buildMapPayload({ ...base, airportTo: null })).toBeNull();
  });

  it('builds endpoints, route, and categories', () => {
    const m = buildMapPayload(base);
    expect(m.from).toEqual({ icao: 'KAUS', lat: 30.19, lon: -97.67, category: 'VFR' });
    expect(m.to).toEqual({ icao: 'KABQ', lat: 35.04, lon: -106.61, category: 'MVFR' });
    expect(m.route).toHaveLength(33);
    expect(m.route[0]).toEqual([30.19, -97.67]);
  });

  it('parses real hazard geometry and tags convective kind', () => {
    const m = buildMapPayload({ ...base, sigmets: [REAL_SIGMET] });
    expect(m.hazardPolygons).toHaveLength(1);
    expect(m.hazardPolygons[0].kind).toBe('convective');
    expect(m.hazardPolygons[0].coords).toHaveLength(6);
  });

  it('tags non-convective sigmet and airmet kinds', () => {
    const m = buildMapPayload({
      ...base,
      sigmets: [{ hazard: 'ICE', coords: [{ lat: 40, lon: -80 }, { lat: 41, lon: -81 }] }],
      airmets: [{ hazard: 'IFR', coords: [{ lat: 39, lon: -79 }, { lat: 38, lon: -78 }] }]
    });
    expect(m.hazardPolygons.map((h) => h.kind)).toEqual(['sigmet', 'airmet']);
  });

  it('skips hazards with malformed geometry, never throws', () => {
    const m = buildMapPayload({
      ...base,
      sigmets: [{ hazard: 'CONVECTIVE' }, REAL_SIGMET, { hazard: 'ICE', coords: 'nope' }]
    });
    expect(m.hazardPolygons).toHaveLength(1);
  });
});
