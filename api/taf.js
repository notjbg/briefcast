const { json } = require('./_utils');

const VALID_CODE = /^[A-Z]{3,4}$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const ids = String(req.query.ids || '').trim().toUpperCase();
  if (!ids) return json(res, 400, { error: 'Missing ids query param' });

  const codes = ids.split(',').filter(Boolean).slice(0, 10);
  if (codes.length === 0 || !codes.every((c) => VALID_CODE.test(c))) {
    return json(res, 400, { error: 'Invalid airport code format. Use 3-4 letter ICAO codes.' }, 5);
  }

  try {
    const url = `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(codes.join(','))}&format=json`;
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!upstream.ok) {
      console.error('briefcast.taf.upstream_error', { status: upstream.status });
      return json(res, 502, { error: 'Upstream TAF service unavailable' }, 10);
    }
    const data = await upstream.json();
    return json(res, 200, { ids: codes, tafs: Array.isArray(data) ? data : [] }, 120);
  } catch (error) {
    console.error('briefcast.taf.error', error.message);
    return json(res, 500, { error: 'Failed to fetch TAF data' }, 10);
  }
};
