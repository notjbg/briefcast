const {
  json,
  getCached,
  setCached,
  cachedFetchJson,
  normalizeAirportCode,
  calculateFlightCategory,
  airportForCode
} = require('./_utils');

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

function plainRouteSummary(from, to, depCategory, destCategory, hazardsCount) {
  const hazardLine = hazardsCount
    ? `${hazardsCount} active hazard advisories were returned for this route; review each item before departure.`
    : 'No active hazard advisories were returned in this pull, but continue monitoring updates.';
  return `From ${from} to ${to}, current endpoint flight categories are ${depCategory} at departure and ${destCategory} at destination. ${hazardLine}`;
}

async function maybeTranslateWithAnthropic(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an aviation weather briefer. Convert weather data into concise plain English for a pilot.\n\nReturn strict JSON with keys: routeSummary, departureMetar, departureTaf, destinationMetar, destinationTaf, afdSummary.\n\nData:\n${JSON.stringify(payload)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
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
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const fromCode = normalizeAirportCode(req.query.from);
  const toCode = normalizeAirportCode(req.query.to);
  const departTime = req.query.departTime ? String(req.query.departTime) : null;

  if (!fromCode || !toCode) {
    return json(res, 400, { error: 'Invalid or missing from/to airport code. Use ICAO or IATA.' }, 10);
  }

  const cacheKey = `briefing:${fromCode}:${toCode}:${departTime || 'now'}`;
  const cached = getCached(cacheKey);
  if (cached) return json(res, 200, cached, 180);

  try {
    const airportFrom = airportForCode(fromCode);
    const airportTo = airportForCode(toCode);
    const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(`${fromCode},${toCode}`)}&format=json`;
    const tafUrl = `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(`${fromCode},${toCode}`)}&format=json`;

    const promises = [
      cachedFetchJson(metarUrl, { headers: { Accept: 'application/json' } }, 120_000),
      cachedFetchJson(tafUrl, { headers: { Accept: 'application/json' } }, 120_000)
    ];

    if (airportFrom && airportTo) {
      const bbox = [
        Math.min(airportFrom.lon, airportTo.lon) - 2,
        Math.min(airportFrom.lat, airportTo.lat) - 2,
        Math.max(airportFrom.lon, airportTo.lon) + 2,
        Math.max(airportFrom.lat, airportTo.lat) + 2
      ].join(',');
      promises.push(cachedFetchJson(`https://aviationweather.gov/api/data/pirep?bbox=${bbox}&format=json`, { headers: { Accept: 'application/json' } }, 90_000).catch(() => []));
    } else {
      promises.push(Promise.resolve([]));
    }

    promises.push(cachedFetchJson('https://aviationweather.gov/api/data/airsigmet?format=json', { headers: { Accept: 'application/json' } }, 90_000).catch(() => []));
    promises.push(cachedFetchJson('https://api.weather.gov/alerts/active?event=Temporary%20Flight%20Restriction', { headers: { Accept: 'application/geo+json' } }, 120_000).catch(() => ({ features: [] })));

    let afdRaw = '';
    if (airportTo) {
      try {
        const points = await cachedFetchJson(`https://api.weather.gov/points/${airportTo.lat},${airportTo.lon}`, { headers: { Accept: 'application/geo+json', 'User-Agent': 'briefcast/1.0' } }, 24 * 60_000);
        const office = points?.properties?.gridId;
        if (office) {
          const afdProducts = await cachedFetchJson(`https://api.weather.gov/products/types/AFD/locations/${office}?limit=1`, { headers: { Accept: 'application/geo+json', 'User-Agent': 'briefcast/1.0' } }, 15 * 60_000);
          const latest = afdProducts?.['@graph']?.[0]?.id;
          if (latest) {
            const afdDetail = await cachedFetchJson(latest, { headers: { Accept: 'application/geo+json', 'User-Agent': 'briefcast/1.0' } }, 15 * 60_000);
            afdRaw = afdDetail?.productText || '';
          }
        }
      } catch (afdError) {
        console.warn('briefcast.afd_fetch_failed', afdError.message);
      }
    }

    const [metars, tafs, pirepsRaw, airsigmetsRaw, tfrAlerts] = await Promise.all(promises);

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
    } catch (aiError) {
      console.warn('briefcast.ai_translate_failed', aiError.message);
    }

    const output = {
      routeSummary: ai?.routeSummary || plainRouteSummary(fromCode, toCode, depCategory, destCategory, hazards.length),
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
      }
    };

    setCached(cacheKey, output, BRIEFING_TTL_MS);
    return json(res, 200, output, 180);
  } catch (error) {
    return json(res, 500, { error: 'Failed to generate briefing', detail: error.message }, 10);
  }
};
