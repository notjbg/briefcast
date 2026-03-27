const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../api/briefing');
const { summarizeHazards, summarizePireps, selectAfdText, plainRouteSummary } = _test;

describe('summarizeHazards', () => {
  it('returns empty array with no inputs', () => {
    assert.deepEqual(summarizeHazards(), []);
  });

  it('formats SIGMETs', () => {
    const result = summarizeHazards([{ airSigmetId: 'WS1', hazard: 'TURB' }]);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('SIGMET'));
    assert.ok(result[0].includes('TURB'));
  });

  it('formats AIRMETs', () => {
    const result = summarizeHazards([], [{ hazard: 'IFR', phenomenon: 'fog' }]);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('AIRMET'));
  });

  it('formats TFRs', () => {
    const result = summarizeHazards([], [], [{ notamId: 'TFR-001', description: 'Presidential airspace' }]);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('TFR'));
    assert.ok(result[0].includes('Presidential'));
  });

  it('limits each category to 5 items', () => {
    const sigmets = Array.from({ length: 10 }, (_, i) => ({ hazard: `SIG${i}` }));
    const result = summarizeHazards(sigmets);
    assert.equal(result.length, 5);
  });
});

describe('summarizePireps', () => {
  it('returns empty array with no input', () => {
    assert.deepEqual(summarizePireps(), []);
    assert.deepEqual(summarizePireps([]), []);
  });

  it('formats pilot reports', () => {
    const result = summarizePireps([{ stationId: 'KORD', obsTime: '2100Z', report: 'Moderate turbulence FL250' }]);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('KORD'));
    assert.ok(result[0].includes('Moderate turbulence'));
  });

  it('limits to 10 reports', () => {
    const pireps = Array.from({ length: 20 }, (_, i) => ({ stationId: `K${i}`, report: 'test' }));
    assert.equal(summarizePireps(pireps).length, 10);
  });
});

describe('selectAfdText', () => {
  it('returns empty string for empty input', () => {
    assert.equal(selectAfdText(''), '');
    assert.equal(selectAfdText(), '');
  });

  it('extracts .AVIATION block', () => {
    const afd = '.SYNOPSIS...\nSome synopsis text.\n.AVIATION...\nVFR conditions expected.\n.MARINE...\nWaves 2-4 ft.';
    const result = selectAfdText(afd);
    assert.ok(result.includes('VFR conditions expected'));
    assert.ok(!result.includes('MARINE'));
  });

  it('handles && delimiter', () => {
    const afd = '.AVIATION...\nClear skies with light winds.\n&&\nSome other section.';
    const result = selectAfdText(afd);
    assert.ok(result.includes('Clear skies'));
  });

  it('returns full text when no .AVIATION header', () => {
    const afd = 'General forecast discussion with no aviation section.';
    const result = selectAfdText(afd);
    assert.ok(result.includes('General forecast'));
  });

  it('truncates at 2400 chars', () => {
    const longText = 'A'.repeat(3000);
    const afd = '.AVIATION...\n' + longText + '\n.NEXT...';
    const result = selectAfdText(afd);
    assert.ok(result.length <= 2400);
  });
});

describe('plainRouteSummary', () => {
  it('includes from/to codes and categories', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'VFR', 0);
    assert.ok(result.includes('KORD'));
    assert.ok(result.includes('KLAX'));
    assert.ok(result.includes('VFR'));
  });

  it('mentions hazard count when present', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'IFR', 3);
    assert.ok(result.includes('3'));
    assert.ok(result.includes('hazard'));
  });

  it('says no hazards when count is 0 and fetch succeeded', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'VFR', 0, true);
    assert.ok(result.includes('No active hazard'));
  });

  it('shows unavailable message when hazard fetch failed', () => {
    const result = plainRouteSummary('KORD', 'KLAX', 'VFR', 'VFR', 0, false);
    assert.ok(result.includes('temporarily unavailable'));
  });
});
