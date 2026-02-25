const { AIRPORTS } = require('./_airports');

const memoryCache = globalThis.__briefcastCache || new Map();
globalThis.__briefcastCache = memoryCache;

const airportByIcao = new Map(AIRPORTS.map((a) => [a.icao, a]));
const airportByIata = new Map(AIRPORTS.filter((a) => a.iata).map((a) => [a.iata, a.icao]));

function json(res, status, payload, cacheSeconds = 60) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=${Math.max(cacheSeconds * 2, 60)}`);
  res.end(JSON.stringify(payload));
}

function getCached(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value, ttlMs) {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function cachedFetchJson(url, options = {}, ttlMs = 60_000) {
  const key = `fetch:${url}`;
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch failed ${res.status}: ${body.slice(0, 180)}`);
  }
  const data = await res.json();
  setCached(key, data, ttlMs);
  return data;
}

function normalizeAirportCode(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  if (airportByIcao.has(raw)) return raw;
  if (airportByIata.has(raw)) return airportByIata.get(raw);
  return null;
}

function parseMetarFields(rawOb) {
  if (!rawOb || typeof rawOb !== 'string') return { ceilingFt: null, visibilitySm: null };
  const tokens = rawOb.split(/\s+/);

  let visibilitySm = null;
  const visToken = tokens.find((t) => /^(\d+|\d+\/\d+|P6)SM$/.test(t));
  if (visToken) {
    if (visToken === 'P6SM') visibilitySm = 6;
    else {
      const v = visToken.replace('SM', '');
      if (v.includes('/')) {
        const [n, d] = v.split('/').map(Number);
        if (n && d) visibilitySm = n / d;
      } else {
        visibilitySm = Number(v);
      }
    }
  }

  const cloudTokens = tokens.filter((t) => /^(BKN|OVC|VV)\d{3}/.test(t));
  let ceilingFt = null;
  cloudTokens.forEach((token) => {
    const ft = Number(token.slice(3)) * 100;
    if (Number.isFinite(ft) && (ceilingFt === null || ft < ceilingFt)) ceilingFt = ft;
  });

  return { ceilingFt, visibilitySm };
}

function calculateFlightCategory(rawOb) {
  const { ceilingFt, visibilitySm } = parseMetarFields(rawOb);
  if (ceilingFt === null && visibilitySm === null) return 'UNKNOWN';

  if ((ceilingFt !== null && ceilingFt < 500) || (visibilitySm !== null && visibilitySm < 1)) return 'LIFR';
  if ((ceilingFt !== null && ceilingFt < 1000) || (visibilitySm !== null && visibilitySm < 3)) return 'IFR';
  if ((ceilingFt !== null && ceilingFt <= 3000) || (visibilitySm !== null && visibilitySm <= 5)) return 'MVFR';
  return 'VFR';
}

function airportForCode(icao) {
  return airportByIcao.get(icao) || null;
}

module.exports = {
  AIRPORTS,
  json,
  getCached,
  setCached,
  cachedFetchJson,
  normalizeAirportCode,
  calculateFlightCategory,
  airportForCode
};
