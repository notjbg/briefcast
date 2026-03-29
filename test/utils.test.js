const { describe, it, expect } = require('bun:test');
const {
  normalizeAirportCode,
  calculateFlightCategory,
  parseMetarFields,
  normalizeTimestamp,
  getCached,
  setCached,
  checkRateLimit
} = require('../api/_utils');

describe('normalizeAirportCode', () => {
  it('resolves valid ICAO codes', () => {
    expect(normalizeAirportCode('KORD')).toBe('KORD');
    expect(normalizeAirportCode('KLAX')).toBe('KLAX');
    expect(normalizeAirportCode('kord')).toBe('KORD');
  });

  it('resolves IATA to ICAO', () => {
    expect(normalizeAirportCode('ORD')).toBe('KORD');
    expect(normalizeAirportCode('LAX')).toBe('KLAX');
    expect(normalizeAirportCode('lax')).toBe('KLAX');
  });

  it('accepts any valid 4-letter ICAO code', () => {
    expect(normalizeAirportCode('KBED')).toBe('KBED');
    expect(normalizeAirportCode('ZZZZ')).toBe('ZZZZ');
    expect(normalizeAirportCode('kbed')).toBe('KBED');
  });

  it('returns null for invalid codes', () => {
    expect(normalizeAirportCode('XX')).toBeNull();
    expect(normalizeAirportCode('')).toBeNull();
    expect(normalizeAirportCode(null)).toBeNull();
    expect(normalizeAirportCode(undefined)).toBeNull();
    expect(normalizeAirportCode('12345')).toBeNull();
    expect(normalizeAirportCode('AB')).toBeNull();
  });
});

describe('parseMetarFields', () => {
  it('parses standard visibility', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 10SM FEW250 M01/M12 A3032');
    expect(visibilitySm).toBe(10);
  });

  it('parses P6SM as 6', () => {
    const { visibilitySm } = parseMetarFields('KLAX 261953Z 25010KT P6SM SKC 16/08 A2998');
    expect(visibilitySm).toBe(6);
  });

  it('parses fractional visibility (1/2SM)', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 1/2SM OVC002 M01/M12 A3032');
    expect(visibilitySm).toBe(0.5);
  });

  it('parses mixed-number visibility (1 1/2SM)', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 1 1/2SM BKN020 M01/M12 A3032');
    expect(visibilitySm).toBe(1.5);
  });

  it('parses mixed-number visibility (2 1/4SM)', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 2 1/4SM OVC005 M01/M12 A3032');
    expect(visibilitySm).toBe(2.25);
  });

  it('returns null for missing visibility', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT BKN020');
    expect(visibilitySm).toBeNull();
  });

  it('returns null for empty input', () => {
    const result = parseMetarFields('');
    expect(result).toEqual({ ceilingFt: null, visibilitySm: null });
  });

  it('returns null for null input', () => {
    const result = parseMetarFields(null);
    expect(result).toEqual({ ceilingFt: null, visibilitySm: null });
  });

  it('parses ceiling from BKN layer', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM BKN020 M01/M12 A3032');
    expect(ceilingFt).toBe(2000);
  });

  it('parses ceiling from OVC layer', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM OVC005 M01/M12 A3032');
    expect(ceilingFt).toBe(500);
  });

  it('uses lowest ceiling when multiple layers', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM BKN020 OVC040 M01/M12 A3032');
    expect(ceilingFt).toBe(2000);
  });

  it('ignores FEW and SCT for ceiling', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM FEW010 SCT020 M01/M12 A3032');
    expect(ceilingFt).toBeNull();
  });
});

describe('calculateFlightCategory', () => {
  it('returns VFR for clear skies and good visibility', () => {
    expect(calculateFlightCategory('KLAX 261953Z 25010KT P6SM SKC 16/08 A2998')).toBe('VFR');
  });

  it('returns UNKNOWN for unparseable METAR', () => {
    expect(calculateFlightCategory('')).toBe('UNKNOWN');
    expect(calculateFlightCategory('garbage')).toBe('UNKNOWN');
  });

  // Ceiling boundary tests
  it('returns LIFR for ceiling 499ft', () => {
    expect(calculateFlightCategory('KORD 10SM BKN004')).toBe('LIFR'); // 400ft
  });

  it('returns IFR for ceiling exactly 500ft', () => {
    expect(calculateFlightCategory('KORD 10SM BKN005')).toBe('IFR'); // 500ft
  });

  it('returns IFR for ceiling 999ft', () => {
    expect(calculateFlightCategory('KORD 10SM OVC009')).toBe('IFR'); // 900ft
  });

  it('returns MVFR for ceiling exactly 1000ft', () => {
    expect(calculateFlightCategory('KORD 10SM OVC010')).toBe('MVFR'); // 1000ft
  });

  it('returns MVFR for ceiling 3000ft', () => {
    expect(calculateFlightCategory('KORD 10SM BKN030')).toBe('MVFR'); // 3000ft
  });

  it('returns VFR for ceiling 3100ft', () => {
    expect(calculateFlightCategory('KORD 10SM BKN031')).toBe('VFR'); // 3100ft
  });

  // Visibility boundary tests
  it('returns LIFR for visibility < 1SM', () => {
    expect(calculateFlightCategory('KORD 1/2SM SKC')).toBe('LIFR');
  });

  it('returns IFR for visibility exactly 1SM', () => {
    expect(calculateFlightCategory('KORD 1SM SKC')).toBe('IFR');
  });

  it('returns IFR for visibility 2SM', () => {
    expect(calculateFlightCategory('KORD 2SM SKC')).toBe('IFR');
  });

  it('returns MVFR for visibility 3SM', () => {
    expect(calculateFlightCategory('KORD 3SM SKC')).toBe('MVFR');
  });

  it('returns MVFR for visibility 5SM', () => {
    expect(calculateFlightCategory('KORD 5SM SKC')).toBe('MVFR');
  });

  it('returns VFR for visibility > 5SM', () => {
    expect(calculateFlightCategory('KORD 10SM SKC')).toBe('VFR');
  });

  it('returns VFR for P6SM', () => {
    expect(calculateFlightCategory('KORD P6SM SKC')).toBe('VFR');
  });

  // Mixed-number visibility (1.5 SM < 3 SM = IFR)
  it('handles 1 1/2SM as IFR', () => {
    expect(calculateFlightCategory('KORD 1 1/2SM SKC')).toBe('IFR');
  });
});

describe('normalizeTimestamp', () => {
  it('converts unix seconds to ISO', () => {
    expect(normalizeTimestamp(1774803180)).toBe('2026-03-29T16:53:00.000Z');
  });

  it('converts unix milliseconds to ISO', () => {
    expect(normalizeTimestamp(1774803180000)).toBe('2026-03-29T16:53:00.000Z');
  });

  it('passes ISO strings through', () => {
    expect(normalizeTimestamp('2026-03-29T17:00:00.000Z')).toBe('2026-03-29T17:00:00.000Z');
  });

  it('returns null for invalid input', () => {
    expect(normalizeTimestamp('not-a-time')).toBeNull();
    expect(normalizeTimestamp(null)).toBeNull();
  });
});

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const ip = 'test-allow-' + Date.now();
    expect(checkRateLimit(ip, 3, 60_000)).toBe(true);
    expect(checkRateLimit(ip, 3, 60_000)).toBe(true);
    expect(checkRateLimit(ip, 3, 60_000)).toBe(true);
  });

  it('blocks requests over the limit', () => {
    const ip = 'test-block-' + Date.now();
    checkRateLimit(ip, 2, 60_000);
    checkRateLimit(ip, 2, 60_000);
    expect(checkRateLimit(ip, 2, 60_000)).toBe(false);
  });

  it('resets after window expires', async () => {
    const ip = 'test-reset-' + Date.now();
    checkRateLimit(ip, 1, 10);
    await new Promise(r => setTimeout(r, 15));
    expect(checkRateLimit(ip, 1, 10)).toBe(true);
  });
});

describe('cache', () => {
  it('returns cached values within TTL', () => {
    setCached('test-key-hit', { data: 42 }, 60_000);
    expect(getCached('test-key-hit')).toEqual({ data: 42 });
  });

  it('returns null for expired entries', () => {
    setCached('test-key-expired', { data: 1 }, 1);
    // Force expiry by waiting a tick
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy wait 5ms
    expect(getCached('test-key-expired')).toBeNull();
  });

  it('returns null for missing keys', () => {
    expect(getCached('test-key-nonexistent-' + Date.now())).toBeNull();
  });
});
