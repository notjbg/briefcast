const { categoryFromFields } = require('./_utils');
const { endpointWeatherReasons, STANDARD_MINIMUMS } = require('../public/verdict.js');

const CATEGORY_RANK = { VFR: 3, MVFR: 2, IFR: 1, LIFR: 0, UNKNOWN: 2.5 };

function parseVisib(visib) {
  if (typeof visib === 'number' && Number.isFinite(visib)) return visib;
  if (typeof visib === 'string') {
    const m = visib.match(/^([\d.]+)\+?$/);
    if (m) return Number(m[1]);
  }
  return null;
}

function periodConditions(fcst) {
  const clouds = Array.isArray(fcst.clouds) ? fcst.clouds : [];
  let ceilingFt = null;
  clouds.forEach((c) => {
    if (/^(BKN|OVC|VV)$/.test(String(c.cover || '').toUpperCase())) {
      const base = Number(c.base);
      if (Number.isFinite(base) && (ceilingFt === null || base < ceilingFt)) ceilingFt = base;
    }
  });
  return {
    ceilingFt,
    visibilitySm: parseVisib(fcst.visib),
    windKt: Number.isFinite(fcst.wspd) ? fcst.wspd : null,
    gustKt: Number.isFinite(fcst.wgst) ? fcst.wgst : null
  };
}

// Pessimistic merge: take the worse of base and overlay for every field.
function worseOf(a, b) {
  if (!b) return a;
  const minCeil = [a.ceilingFt, b.ceilingFt].filter((v) => v !== null);
  const minVis = [a.visibilitySm, b.visibilitySm].filter((v) => v !== null);
  const maxWind = [a.windKt, b.windKt].filter((v) => v !== null);
  const maxGust = [a.gustKt, b.gustKt].filter((v) => v !== null);
  return {
    ceilingFt: minCeil.length ? Math.min(...minCeil) : null,
    visibilitySm: minVis.length ? Math.min(...minVis) : null,
    windKt: maxWind.length ? Math.max(...maxWind) : null,
    gustKt: maxGust.length ? Math.max(...maxGust) : null
  };
}

function isOverlay(fcst) {
  const c = String(fcst.fcstChange || '').toUpperCase();
  return c === 'TEMPO' || c.startsWith('PROB') || fcst.probability != null;
}

function buildTimeline(taf, nowMs, hours = 12) {
  const fcsts = taf && Array.isArray(taf.fcsts) ? taf.fcsts : null;
  if (!fcsts || !fcsts.length) return null;
  const icao = taf.icaoId || 'endpoint';

  const startHour = Math.floor(nowMs / 3600_000) * 3600_000;
  const out = [];

  for (let h = 0; h < hours; h++) {
    const t = startHour + h * 3600_000;
    const covering = (f) => f.timeFrom * 1000 <= t && t < f.timeTo * 1000;

    const bases = fcsts.filter((f) => !isOverlay(f) && covering(f));
    if (!bases.length) continue; // never invent data for uncovered hours
    const base = bases[bases.length - 1]; // last in-effect base period wins (FM/BECMG in effect from timeFrom)

    let cond = periodConditions(base);
    fcsts.filter((f) => isOverlay(f) && covering(f)).forEach((overlay) => {
      cond = worseOf(cond, periodConditions(overlay));
    });

    const category = categoryFromFields(cond.ceilingFt, cond.visibilitySm);
    const reasons = endpointWeatherReasons(icao, { ...cond, category }, STANDARD_MINIMUMS);
    let verdict = 'GO';
    if (reasons.some((r) => r.severity === 'no-go')) verdict = 'NO-GO';
    else if (reasons.some((r) => r.severity === 'marginal')) verdict = 'MARGINAL';

    out.push({ hourIso: new Date(t).toISOString(), category, verdict });
  }

  return out.length ? out : null;
}

module.exports = { buildTimeline, _test: { parseVisib, periodConditions, worseOf, isOverlay } };
