const { AIRPORTS } = require('./_airports');

const memoryCache = globalThis.__briefcastCache || new Map();
globalThis.__briefcastCache = memoryCache;

const failureTracker = globalThis.__briefcastFailures || new Map();
globalThis.__briefcastFailures = failureTracker;

const airportByIcao = new Map(AIRPORTS.map((a) => [a.icao, a]));
const airportByIata = new Map(AIRPORTS.filter((a) => a.iata).map((a) => [a.iata, a.icao]));

function json(res, status, payload, cacheSeconds = 60) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=${Math.max(cacheSeconds * 2, 60)}`);
  res.end(JSON.stringify(payload));
}

const staleCache = globalThis.__briefcastStaleCache || new Map();
globalThis.__briefcastStaleCache = staleCache;

function getCached(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    staleCache.set(key, hit.value);
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

function getStaleCached(key) {
  const fresh = memoryCache.get(key);
  if (fresh) return fresh.value;
  return staleCache.get(key) || null;
}

function setCached(key, value, ttlMs) {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function recordFailure(hostname) {
  const now = Date.now();
  const entry = failureTracker.get(hostname) || { failures: [], lastSuccess: 0 };
  entry.failures.push(now);
  entry.failures = entry.failures.filter((t) => now - t < 60_000);
  failureTracker.set(hostname, entry);
  return entry.failures.length;
}

function recordSuccess(hostname) {
  failureTracker.set(hostname, { failures: [], lastSuccess: Date.now() });
}

function isHostDegraded(hostname) {
  const entry = failureTracker.get(hostname);
  if (!entry) return false;
  const recent = entry.failures.filter((t) => Date.now() - t < 60_000);
  return recent.length >= 3;
}

const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

async function cachedFetchJson(url, options = {}, ttlMs = 60_000) {
  const key = `fetch:${url}`;
  const cached = getCached(key);
  if (cached) return cached;

  const hostname = getHostname(url);

  if (isHostDegraded(hostname)) {
    const stale = getStaleCached(key);
    if (stale) {
      console.log('briefcast.upstream.stale_served', { hostname, url: url.slice(0, 120) });
      stale.__stale = true;
      return stale;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Fetch failed ${res.status}: ${body.slice(0, 180)}`);
    }

    const data = await res.json();
    setCached(key, data, ttlMs);
    recordSuccess(hostname);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    const failCount = recordFailure(hostname);

    if (failCount >= 3) {
      const stale = getStaleCached(key);
      if (stale) {
        console.log('briefcast.upstream.stale_served', { hostname, failCount, url: url.slice(0, 120) });
        stale.__stale = true;
        return stale;
      }
    }

    console.warn('briefcast.upstream.failure_tracked', { hostname, failCount, error: err.message?.slice(0, 120) });
    throw err;
  }
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
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^P6SM$/.test(t)) {
      visibilitySm = 6;
      break;
    }
    if (/^\d+\/\d+SM$/.test(t)) {
      const prev = i > 0 ? tokens[i - 1] : null;
      const frac = t.replace('SM', '');
      const [n, d] = frac.split('/').map(Number);
      const fracVal = n && d ? n / d : 0;
      if (prev && /^\d+$/.test(prev) && !(/^\d{3,4}$/.test(prev) && i > 1)) {
        visibilitySm = Number(prev) + fracVal;
      } else {
        visibilitySm = fracVal;
      }
      break;
    }
    if (/^\d+SM$/.test(t)) {
      visibilitySm = Number(t.replace('SM', ''));
      break;
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
  getStaleCached,
  setCached,
  cachedFetchJson,
  normalizeAirportCode,
  parseMetarFields,
  calculateFlightCategory,
  airportForCode
};
