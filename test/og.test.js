const { describe, it, expect } = require('bun:test');
const { STAMP_HEX, validateCodes, selectCardData, formatZulu } = require('../api/_og-data');

describe('validateCodes', () => {
  it('accepts a 4-letter ICAO pair and upper-cases it', () => {
    expect(validateCodes('kaus', 'KABQ')).toEqual({ ok: true, from: 'KAUS', to: 'KABQ' });
  });

  it('accepts 3-char IATA codes', () => {
    expect(validateCodes('aus', 'abq')).toEqual({ ok: true, from: 'AUS', to: 'ABQ' });
  });

  it('trims surrounding whitespace', () => {
    expect(validateCodes('  kaus  ', ' kabq ')).toEqual({ ok: true, from: 'KAUS', to: 'KABQ' });
  });

  it('rejects an injection attempt', () => {
    expect(validateCodes('<script>', 'KABQ').ok).toBe(false);
  });

  it('rejects empty / missing values', () => {
    expect(validateCodes('', 'KABQ').ok).toBe(false);
    expect(validateCodes('KAUS', '').ok).toBe(false);
    expect(validateCodes(null, undefined).ok).toBe(false);
  });

  it('rejects 5+ character codes', () => {
    expect(validateCodes('KAUST', 'KABQ').ok).toBe(false);
  });

  it('rejects 2-character codes (too short)', () => {
    expect(validateCodes('KA', 'KABQ').ok).toBe(false);
  });

  it('rejects codes with spaces or punctuation inside', () => {
    expect(validateCodes('KA S', 'KABQ').ok).toBe(false);
    expect(validateCodes('KA-', 'KABQ').ok).toBe(false);
  });

  it('returns null codes on failure', () => {
    expect(validateCodes('bad!', 'KABQ')).toEqual({ ok: false, from: null, to: null });
  });
});

describe('selectCardData — stamp color mapping', () => {
  const cases = [
    ['GO', '#1F7A3D'],
    ['MARGINAL', '#B07C10'],
    ['NO-GO', '#B3261E'],
    ['INSUFFICIENT DATA', '#5F6368']
  ];
  for (const [verdict, hex] of cases) {
    it(`maps ${verdict} → ${hex}`, () => {
      const out = selectCardData({ verdict: { verdict, reasons: [] } }, 'KAUS', 'KABQ');
      expect(out.verdict).toBe(verdict);
      expect(out.stampHex).toBe(hex);
    });
  }

  it('STAMP_HEX table matches the spec exactly', () => {
    expect(STAMP_HEX).toEqual({
      GO: '#1F7A3D',
      MARGINAL: '#B07C10',
      'NO-GO': '#B3261E',
      'INSUFFICIENT DATA': '#5F6368'
    });
  });
});

describe('selectCardData — degradation', () => {
  it('degrades unknown verdict to INSUFFICIENT DATA styling', () => {
    const out = selectCardData({ verdict: { verdict: 'MAYBE', reasons: [] } }, 'KAUS', 'KABQ');
    expect(out.verdict).toBe('INSUFFICIENT DATA');
    expect(out.stampHex).toBe('#5F6368');
  });

  it('degrades a null payload without throwing', () => {
    const out = selectCardData(null, 'kaus', 'kabq');
    expect(out.verdict).toBe('INSUFFICIENT DATA');
    expect(out.stampHex).toBe('#5F6368');
    expect(out.reasons).toEqual([]);
    expect(out.route).toBe('KAUS → KABQ');
  });

  it('degrades an empty object without throwing', () => {
    const out = selectCardData({}, 'KAUS', 'KABQ');
    expect(out.verdict).toBe('INSUFFICIENT DATA');
    expect(out.reasons).toEqual([]);
  });
});

describe('selectCardData — route + timestamp', () => {
  it('builds an upper-cased route string with the arrow glyph', () => {
    const out = selectCardData({ verdict: { verdict: 'GO', reasons: [] } }, 'kaus', 'kabq');
    expect(out.route).toBe('KAUS → KABQ');
  });

  it('passes generatedAt through when it is a string', () => {
    const iso = '2026-07-06T15:30:00Z';
    const out = selectCardData({ verdict: { verdict: 'GO', reasons: [] }, generatedAt: iso }, 'KAUS', 'KABQ');
    expect(out.generatedAt).toBe(iso);
  });

  it('yields null generatedAt when absent', () => {
    const out = selectCardData({ verdict: { verdict: 'GO', reasons: [] } }, 'KAUS', 'KABQ');
    expect(out.generatedAt).toBeNull();
  });
});

describe('selectCardData — reason selection', () => {
  it('extracts reason .text values', () => {
    const payload = { verdict: { verdict: 'NO-GO', reasons: [{ severity: 'no-go', text: 'Convective SIGMET active' }] } };
    expect(selectCardData(payload, 'KAUS', 'KABQ').reasons).toEqual(['Convective SIGMET active']);
  });

  it('truncates to at most 3 reasons', () => {
    const payload = {
      verdict: {
        verdict: 'MARGINAL',
        reasons: [
          { text: 'one' },
          { text: 'two' },
          { text: 'three' },
          { text: 'four' },
          { text: 'five' }
        ]
      }
    };
    const out = selectCardData(payload, 'KAUS', 'KABQ');
    expect(out.reasons).toEqual(['one', 'two', 'three']);
  });

  it('drops reasons with missing / non-string / blank text', () => {
    const payload = {
      verdict: {
        verdict: 'GO',
        reasons: [{ text: '  clear skies  ' }, { text: '' }, { severity: 'ok' }, { text: 42 }, null]
      }
    };
    expect(selectCardData(payload, 'KAUS', 'KABQ').reasons).toEqual(['clear skies']);
  });

  it('handles a non-array reasons field', () => {
    const payload = { verdict: { verdict: 'GO', reasons: 'nope' } };
    expect(selectCardData(payload, 'KAUS', 'KABQ').reasons).toEqual([]);
  });
});

describe('formatZulu', () => {
  it('formats an ISO timestamp as DDHHMMZ', () => {
    expect(formatZulu('2026-07-06T15:30:00Z')).toBe('061530Z');
  });

  it('zero-pads day/hour/minute', () => {
    expect(formatZulu('2026-07-06T05:07:00Z')).toBe('060507Z');
  });

  it('returns null for unparseable or missing input', () => {
    expect(formatZulu('not-a-date')).toBeNull();
    expect(formatZulu(null)).toBeNull();
    expect(formatZulu('')).toBeNull();
    expect(formatZulu(12345)).toBeNull();
  });
});
