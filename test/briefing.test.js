const { describe, it, expect } = require('bun:test');
const { _test } = require('../api/briefing');
const { summarizeHazards, summarizePireps, selectAfdText, plainRouteSummary } = _test;

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
