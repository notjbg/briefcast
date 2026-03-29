const {
  json,
  getCached,
  setCached,
  cachedFetchJson,
  normalizeAirportCode,
  calculateFlightCategory,
  airportForCode,
  checkRateLimit
} = require('./_utils');
const { z } = require('zod');

const AiBriefingSchema = z.object({
  routeSummary: z.string().optional(),
  departureMetar: z.string().optional(),
  departureTaf: z.string().optional(),
  destinationMetar: z.string().optional(),
  destinationTaf: z.string().optional(),
  afdSummary: z.string().optional()
}).passthrough();

const BRIEFING_TTL_MS = 5 * 60_000;

function byStation(list, stationId) {
  if (!Array.isArray(list)) return null;
  return list.find((entry) => String(entry.icaoId || entry.stationId || entry.station || '').toUpperCase() === stationId) || null;
}

function summarizeHazards(sigmets = [], airmets = [], tfrs = []) {
  const out = [];

  sigmets.slice(0, 5).forEach((s) => {
    const id = s.airSigmetId || s.rawSigmet || s.hazard || 'SIGMET';
    const hazard = s.hazard || s.phenomenon || 'hazard';
    const valid = s.validTimeFrom || s.validTimeTo || s.obsTime || '';
    out.push(`SIGMET ${id}: ${hazard}${valid ? ` (${valid})` : ''}`);
  });

  airmets.slice(0, 5).forEach((a) => {
    const id = a.airSigmetId || a.hazard || 'AIRMET';
    const hazard = a.hazard || a.phenomenon || 'hazard';
    out.push(`AIRMET ${id}: ${hazard}`);
  });

  tfrs.slice(0, 5).forEach((t) => {
    const id = t.notamId || t.id || 'TFR';
    const text = t.text || t.description || 'Temporary Flight Restriction in effect';
    out.push(`TFR ${id}: ${text.slice(0, 180)}`);
  });

  return out;
}

function summarizePireps(list = []) {
  return list.slice(0, 10).map((p) => {
    const station = p.stationId || p.icaoId || 'UNK';
    const tm = p.obsTime || p.reportTime || '';
    const text = p.report || p.rawOb || p.wxString || p.skyCond || 'Pilot report';
    return `${station}${tm ? ` ${tm}` : ''}: ${text}`;
  });
}

function selectAfdText(raw = '') {
  if (!raw) return '';
  const normalized = raw.replace(/\r/g, '');
  const aviationBlock = normalized.match(/\.AVIATION\.\.\.(.*?)(\n\.[A-Z]|\n&&|$)/s);
  if (aviationBlock) return aviationBlock[1].trim().slice(0, 2400);
  return normalized.slice(0, 2400);
}

function plainRouteSummary(from, to, depCategory, destCategory, hazardsCount, hazardsFetchOk = true) {
  let hazardLine;
  if (!hazardsFetchOk) {
    hazardLine = 'Hazard data temporarily unavailable. Check aviationweather.gov directly before departure.';
  } else if (hazardsCount) {
    hazardLine = `${hazardsCount} active hazard advisories were returned for this route; review each item before departure.`;
  } else {
    hazardLine = 'No active hazard advisories were returned in this pull, but continue monitoring updates.';
  }
  return `From ${from} to ${to}, current endpoint flight categories are ${depCategory} at departure and ${destCategory} at destination. ${hazardLine}`;
}

let _apiKeyWarned = false;

async function maybeTranslateWithAnthropic(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (!_apiKeyWarned) {
      console.warn('briefcast.config.missing_key', 'ANTHROPIC_API_KEY not set — AI translations disabled. Core feature is degraded.');
      _apiKeyWarned = true;
    }
    return null;
  }

  const prompt = `You are an aviation weather briefer. Convert weather data into concise plain English for a pilot.\n\nReturn strict JSON with keys: routeSummary, departureMetar, departureTaf, destinationMetar, destinationTaf, afdSummary.\n\nData:\n${JSON.stringify(payload)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 650,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${text.slice(0, 240)}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text || '';
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return null;

  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return AiBriefingSchema.parse(parsed);
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const startTime = Date.now();

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    console.warn('briefcast.briefing.rate_limited', { ip: clientIp });
    return json(res, 429, { error: 'Too many requests. Please wait a minute before trying again.' }, 5);
  }

  const fromCode = normalizeAirportCode(req.query.from);
  const toCode = normalizeAirportCode(req.query.to);
  let departTime = null;
  if (req.query.departTime) {
    const parsed = new Date(String(req.query.departTime));
    if (!isNaN(parsed.getTime())) {
      // Round to nearest 15 min for cache stability
      const ms = parsed.getTime();
      const rounded = new Date(Math.round(ms / (15 * 60_000)) * 15 * 60_000);
      departTime = rounded.toISOString();
    }
  }

  if (!fromCode || !toCode) {
    return json(res, 400, { error: 'Invalid or missing from/to airport code. Use ICAO or IATA.' }, 10);
  }

  console.log('briefcast.briefing.request', { from: fromCode, to: toCode, departTime });

  const cacheKey = `briefing:${fromCode}:${toCode}:${departTime || 'now'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log('briefcast.briefing.cache_hit', { from: fromCode, to: toCode, latencyMs: Date.now() - startTime });
    return json(res, 200, cached, 180);
  }

  try {
    const airportFrom = airportForCode(fromCode);
    const airportTo = airportForCode(toCode);
    const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(`${fromCode},${toCode}`)}&format=json`;
    const tafUrl = `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(`${fromCode},${toCode}`)}&format=json`;

    let hazardsFetchOk = true;
    const promises = [
      cachedFetchJson(metarUrl, { headers: { Accept: 'application/json' } }, 120_000).catch(() => []),
      cachedFetchJson(tafUrl, { headers: { Accept: 'application/json' } }, 120_000).catch(() => [])
    ];

    let bbox = '';
    if (airportFrom && airportTo) {
      bbox = [
        Math.min(airportFrom.lon, airportTo.lon) - 2,
        Math.min(airportFrom.lat, airportTo.lat) - 2,
        Math.max(airportFrom.lon, airportTo.lon) + 2,
        Math.max(airportFrom.lat, airportTo.lat) + 2
      ].join(',');
      promises.push(cachedFetchJson(`https://aviationweather.gov/api/data/pirep?bbox=${bbox}&format=json`, { headers: { Accept: 'application/json' } }, 90_000).catch(() => []));
    } else {
      promises.push(Promise.resolve([]));
    }

    const airsigmetUrl = bbox
      ? `https://aviationweather.gov/api/data/airsigmet?bbox=${bbox}&format=json`
      : 'https://aviationweather.gov/api/data/airsigmet?format=json';
    promises.push(cachedFetchJson(airsigmetUrl, { headers: { Accept: 'application/json' } }, 90_000).catch(() => { hazardsFetchOk = false; return []; }));
    promises.push(cachedFetchJson('https://api.weather.gov/alerts/active?event=Temporary%20Flight%20Restriction', { headers: { Accept: 'application/geo+json' } }, 120_000).catch(() => { hazardsFetchOk = false; return { features: [] }; }));

    // AFD fetch runs in parallel with METAR/TAF/PIREP/hazard fetches
    const afdPromise = (async () => {
      if (!airportTo) return '';
      try {
        const points = await cachedFetchJson(`https://api.weather.gov/points/${airportTo.lat},${airportTo.lon}`, { headers: { Accept: 'application/geo+json', 'User-Agent': 'briefcast/1.0' } }, 24 * 60_000);
        const office = points?.properties?.gridId;
        if (!office) return '';
        const afdProducts = await cachedFetchJson(`https://api.weather.gov/products/types/AFD/locations/${office}?limit=1`, { headers: { Accept: 'application/geo+json', 'User-Agent': 'briefcast/1.0' } }, 15 * 60_000);
        const latest = afdProducts?.['@graph']?.[0]?.id;
        if (!latest) return '';
        const afdDetail = await cachedFetchJson(latest, { headers: { Accept: 'application/geo+json', 'User-Agent': 'briefcast/1.0' } }, 15 * 60_000);
        return afdDetail?.productText || '';
      } catch (afdError) {
        console.warn('briefcast.afd_fetch_failed', afdError.message);
        return '';
      }
    })();

    const [[metars, tafs, pirepsRaw, airsigmetsRaw, tfrAlerts], afdRaw] = await Promise.all([
      Promise.all(promises),
      afdPromise
    ]);

    const isStale = !!(metars?.__stale || tafs?.__stale || airsigmetsRaw?.__stale || tfrAlerts?.__stale);

    const departureMetar = byStation(metars, fromCode) || {};
    const destinationMetar = byStation(metars, toCode) || {};
    const departureTaf = byStation(tafs, fromCode) || {};
    const destinationTaf = byStation(tafs, toCode) || {};

    const depCategory = calculateFlightCategory(departureMetar.rawOb || '');
    const destCategory = calculateFlightCategory(destinationMetar.rawOb || '');

    const sigmets = Array.isArray(airsigmetsRaw)
      ? airsigmetsRaw.filter((item) => String(item.airsigmetType || item.hazard || '').toUpperCase().includes('SIGMET'))
      : [];
    const airmets = Array.isArray(airsigmetsRaw)
      ? airsigmetsRaw.filter((item) => String(item.airsigmetType || item.hazard || '').toUpperCase().includes('AIRMET'))
      : [];
    const tfrs = (tfrAlerts?.features || []).map((f) => ({
      id: f?.properties?.id,
      notamId: f?.properties?.event,
      description: f?.properties?.headline || f?.properties?.description || ''
    }));

    const hazards = summarizeHazards(sigmets, airmets, tfrs);
    const pireps = summarizePireps(Array.isArray(pirepsRaw) ? pirepsRaw : []);

    const afdExtract = selectAfdText(afdRaw);

    const aiInput = {
      from: fromCode,
      to: toCode,
      departTime,
      departureMetar: departureMetar.rawOb || '',
      departureTaf: departureTaf.rawTAF || '',
      destinationMetar: destinationMetar.rawOb || '',
      destinationTaf: destinationTaf.rawTAF || '',
      afd: afdExtract,
      hazards,
      pireps: pireps.slice(0, 5),
      conditions: { departure: depCategory, destination: destCategory }
    };

    let ai = null;
    try {
      ai = await maybeTranslateWithAnthropic(aiInput);
      if (ai) console.log('briefcast.briefing.ai_used', { from: fromCode, to: toCode });
    } catch (aiError) {
      console.warn('briefcast.ai_translate_failed', aiError.message);
    }

    const output = {
      routeSummary: ai?.routeSummary || plainRouteSummary(fromCode, toCode, depCategory, destCategory, hazards.length, hazardsFetchOk),
      departure: {
        metar: {
          ...(departureMetar || {}),
          translation: ai?.departureMetar || null
        },
        taf: {
          ...(departureTaf || {}),
          translation: ai?.departureTaf || null
        }
      },
      destination: {
        metar: {
          ...(destinationMetar || {}),
          translation: ai?.destinationMetar || null
        },
        taf: {
          ...(destinationTaf || {}),
          translation: ai?.destinationTaf || null
        }
      },
      afd: {
        raw: afdExtract,
        summary: ai?.afdSummary || null
      },
      hazards,
      pireps,
      conditions: {
        departure: depCategory,
        destination: destCategory
      },
      stale: isStale || undefined,
      generatedAt: new Date().toISOString(),
      aiUsed: !!ai
    };

    setCached(cacheKey, output, BRIEFING_TTL_MS);
    console.log('briefcast.briefing.complete', { from: fromCode, to: toCode, aiUsed: !!ai, latencyMs: Date.now() - startTime });
    return json(res, 200, output, 180);
  } catch (error) {
    console.error('briefcast.briefing.error', { from: fromCode, to: toCode, error: error.message, latencyMs: Date.now() - startTime });
    return json(res, 500, { error: 'Failed to generate briefing' }, 10);
  }
};

module.exports.handler = module.exports;
module.exports._test = { summarizeHazards, summarizePireps, selectAfdText, plainRouteSummary };
