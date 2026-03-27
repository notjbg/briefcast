const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAirportCode,
  calculateFlightCategory,
  parseMetarFields
} = require('../api/_utils');

describe('normalizeAirportCode', () => {
  it('resolves valid ICAO codes', () => {
    assert.equal(normalizeAirportCode('KORD'), 'KORD');
    assert.equal(normalizeAirportCode('KLAX'), 'KLAX');
    assert.equal(normalizeAirportCode('kord'), 'KORD');
  });

  it('resolves IATA to ICAO', () => {
    assert.equal(normalizeAirportCode('ORD'), 'KORD');
    assert.equal(normalizeAirportCode('LAX'), 'KLAX');
    assert.equal(normalizeAirportCode('lax'), 'KLAX');
  });

  it('returns null for invalid codes', () => {
    assert.equal(normalizeAirportCode('ZZZZ'), null);
    assert.equal(normalizeAirportCode('XX'), null);
    assert.equal(normalizeAirportCode(''), null);
    assert.equal(normalizeAirportCode(null), null);
    assert.equal(normalizeAirportCode(undefined), null);
  });
});

describe('parseMetarFields', () => {
  it('parses standard visibility', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 10SM FEW250 M01/M12 A3032');
    assert.equal(visibilitySm, 10);
  });

  it('parses P6SM as 6', () => {
    const { visibilitySm } = parseMetarFields('KLAX 261953Z 25010KT P6SM SKC 16/08 A2998');
    assert.equal(visibilitySm, 6);
  });

  it('parses fractional visibility (1/2SM)', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 1/2SM OVC002 M01/M12 A3032');
    assert.equal(visibilitySm, 0.5);
  });

  it('parses mixed-number visibility (1 1/2SM)', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 1 1/2SM BKN020 M01/M12 A3032');
    assert.equal(visibilitySm, 1.5);
  });

  it('parses mixed-number visibility (2 1/4SM)', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT 2 1/4SM OVC005 M01/M12 A3032');
    assert.equal(visibilitySm, 2.25);
  });

  it('returns null for missing visibility', () => {
    const { visibilitySm } = parseMetarFields('KORD 261951Z 33012KT BKN020');
    assert.equal(visibilitySm, null);
  });

  it('returns null for empty input', () => {
    const result = parseMetarFields('');
    assert.deepEqual(result, { ceilingFt: null, visibilitySm: null });
  });

  it('returns null for null input', () => {
    const result = parseMetarFields(null);
    assert.deepEqual(result, { ceilingFt: null, visibilitySm: null });
  });

  it('parses ceiling from BKN layer', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM BKN020 M01/M12 A3032');
    assert.equal(ceilingFt, 2000);
  });

  it('parses ceiling from OVC layer', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM OVC005 M01/M12 A3032');
    assert.equal(ceilingFt, 500);
  });

  it('uses lowest ceiling when multiple layers', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM BKN020 OVC040 M01/M12 A3032');
    assert.equal(ceilingFt, 2000);
  });

  it('ignores FEW and SCT for ceiling', () => {
    const { ceilingFt } = parseMetarFields('KORD 261951Z 33012KT 10SM FEW010 SCT020 M01/M12 A3032');
    assert.equal(ceilingFt, null);
  });
});

describe('calculateFlightCategory', () => {
  it('returns VFR for clear skies and good visibility', () => {
    assert.equal(calculateFlightCategory('KLAX 261953Z 25010KT P6SM SKC 16/08 A2998'), 'VFR');
  });

  it('returns UNKNOWN for unparseable METAR', () => {
    assert.equal(calculateFlightCategory(''), 'UNKNOWN');
    assert.equal(calculateFlightCategory('garbage'), 'UNKNOWN');
  });

  // Ceiling boundary tests
  it('returns LIFR for ceiling 499ft', () => {
    assert.equal(calculateFlightCategory('KORD 10SM BKN004'), 'LIFR'); // 400ft
  });

  it('returns IFR for ceiling exactly 500ft', () => {
    assert.equal(calculateFlightCategory('KORD 10SM BKN005'), 'IFR'); // 500ft
  });

  it('returns IFR for ceiling 999ft', () => {
    assert.equal(calculateFlightCategory('KORD 10SM OVC009'), 'IFR'); // 900ft
  });

  it('returns MVFR for ceiling exactly 1000ft', () => {
    assert.equal(calculateFlightCategory('KORD 10SM OVC010'), 'MVFR'); // 1000ft
  });

  it('returns MVFR for ceiling 3000ft', () => {
    assert.equal(calculateFlightCategory('KORD 10SM BKN030'), 'MVFR'); // 3000ft
  });

  it('returns VFR for ceiling 3100ft', () => {
    assert.equal(calculateFlightCategory('KORD 10SM BKN031'), 'VFR'); // 3100ft
  });

  // Visibility boundary tests
  it('returns LIFR for visibility < 1SM', () => {
    assert.equal(calculateFlightCategory('KORD 1/2SM SKC'), 'LIFR');
  });

  it('returns IFR for visibility exactly 1SM', () => {
    assert.equal(calculateFlightCategory('KORD 1SM SKC'), 'IFR');
  });

  it('returns IFR for visibility 2SM', () => {
    assert.equal(calculateFlightCategory('KORD 2SM SKC'), 'IFR');
  });

  it('returns MVFR for visibility 3SM', () => {
    assert.equal(calculateFlightCategory('KORD 3SM SKC'), 'MVFR');
  });

  it('returns MVFR for visibility 5SM', () => {
    assert.equal(calculateFlightCategory('KORD 5SM SKC'), 'MVFR');
  });

  it('returns VFR for visibility > 5SM', () => {
    assert.equal(calculateFlightCategory('KORD 10SM SKC'), 'VFR');
  });

  it('returns VFR for P6SM', () => {
    assert.equal(calculateFlightCategory('KORD P6SM SKC'), 'VFR');
  });

  // Mixed-number visibility (1.5 SM < 3 SM = IFR)
  it('handles 1 1/2SM as IFR', () => {
    assert.equal(calculateFlightCategory('KORD 1 1/2SM SKC'), 'IFR');
  });
});
