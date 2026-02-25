const { json } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const ids = String(req.query.ids || '').trim().toUpperCase();
  if (!ids) return json(res, 400, { error: 'Missing ids query param' });

  try {
    const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`;
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!upstream.ok) {
      const body = await upstream.text();
      return json(res, upstream.status, { error: 'Upstream METAR fetch failed', detail: body.slice(0, 200) }, 10);
    }
    const data = await upstream.json();
    return json(res, 200, { ids: ids.split(',').filter(Boolean), metars: Array.isArray(data) ? data : [] }, 120);
  } catch (error) {
    return json(res, 500, { error: 'Failed to fetch METAR data', detail: error.message }, 10);
  }
};
