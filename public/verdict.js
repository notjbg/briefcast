// BriefCast verdict engine — pure, dependency-free, shared by server (require) and browser (script tag).
// The verdict is DETERMINISTIC. Every data gap degrades pessimistically (toward caution), never toward GO.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BriefcastVerdict = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const STANDARD_MINIMUMS = { ceilingFt: 3000, visibilitySm: 5, windKt: 15, gustKt: 20, label: 'standard' };

  function parseWind(rawOb) {
    if (!rawOb || typeof rawOb !== 'string') return { windKt: null, gustKt: null };
    const m = rawOb.match(/(?:^|\s)(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT(?:\s|$)/);
    if (!m) return { windKt: null, gustKt: null };
    return { windKt: Number(m[2]), gustKt: m[3] ? Number(m[3]) : null };
  }

  function reason(severity, code, text) {
    return { severity, code, text };
  }

  // Weather-only rules for a single endpoint. Used for the main verdict and per-hour timeline verdicts.
  function endpointWeatherReasons(name, ep, minimums) {
    const out = [];
    if (!ep) return out;
    if (ep.category === 'IFR' || ep.category === 'LIFR') {
      out.push(reason('no-go', 'ifr_conditions', `${ep.category} conditions at ${name} — VFR flight is not possible`));
    }
    if (ep.ceilingFt !== null && ep.ceilingFt !== undefined && ep.ceilingFt < minimums.ceilingFt) {
      out.push(reason('no-go', 'ceiling_below_min', `Ceiling ${ep.ceilingFt.toLocaleString()} ft at ${name} is below your ${minimums.ceilingFt.toLocaleString()} ft minimum`));
    }
    if (ep.visibilitySm !== null && ep.visibilitySm !== undefined && ep.visibilitySm < minimums.visibilitySm) {
      out.push(reason('no-go', 'visibility_below_min', `Visibility ${ep.visibilitySm} sm at ${name} is below your ${minimums.visibilitySm} sm minimum`));
    }
    if (ep.category === 'MVFR') {
      out.push(reason('marginal', 'mvfr_conditions', `Marginal VFR conditions at ${name}`));
    }
    const effectiveGust = (ep.gustKt !== null && ep.gustKt !== undefined) ? ep.gustKt : ep.windKt;
    if (effectiveGust !== null && effectiveGust !== undefined && effectiveGust > minimums.gustKt) {
      out.push(reason('marginal', 'gusts_above_limit', `Gusts ${effectiveGust} kt at ${name} exceed your ${minimums.gustKt} kt gust limit`));
    }
    if (ep.windKt !== null && ep.windKt !== undefined && ep.windKt > minimums.windKt) {
      out.push(reason('marginal', 'wind_above_limit', `Sustained wind ${ep.windKt} kt at ${name} exceeds your ${minimums.windKt} kt limit`));
    }
    return out;
  }

  function computeVerdict(factors, minimums) {
    const mins = minimums || STANDARD_MINIMUMS;
    const reasons = [];

    // Any dataOk flag that is not exactly `true` (false, undefined, or absent) is a data gap → degrade pessimistically.
    if (factors?.dataOk?.departureMetar !== true) {
      reasons.push(reason('insufficient', 'missing_metar', `No current METAR available for ${factors?.departure?.name || 'departure'}`));
    }
    if (factors?.dataOk?.destinationMetar !== true) {
      reasons.push(reason('insufficient', 'missing_metar', `No current METAR available for ${factors?.destination?.name || 'destination'}`));
    }

    if (factors?.dataOk?.departureMetar) {
      reasons.push(...endpointWeatherReasons(factors.departure?.name || 'departure', factors.departure, mins));
    }
    if (factors?.dataOk?.destinationMetar) {
      reasons.push(...endpointWeatherReasons(factors.destination?.name || 'destination', factors.destination, mins));
    }

    const hz = factors?.hazards || {};
    if (hz.convectiveSigmetOnRoute) {
      reasons.push(reason('no-go', 'convective_sigmet', 'Convective SIGMET active on or near this route — thunderstorm hazard'));
    }
    if (hz.tfrAtEndpoint) {
      reasons.push(reason('no-go', 'tfr_at_endpoint', 'Temporary Flight Restriction near a route endpoint — verify boundaries before flight'));
    }
    if (hz.sigmetOnRoute) {
      reasons.push(reason('marginal', 'sigmet_on_route', 'SIGMET active on or near this route — review before departure'));
    }
    if (hz.airmetOnRoute) {
      reasons.push(reason('marginal', 'airmet_on_route', 'AIRMET active on or near this route — review before departure'));
    }
    if (hz.hazardDataOk === false) {
      reasons.push(reason('marginal', 'hazard_data_unavailable', 'Hazard data is temporarily unavailable — check aviationweather.gov directly before departure'));
    }

    let verdict = 'GO';
    if (reasons.some((r) => r.severity === 'insufficient')) verdict = 'INSUFFICIENT DATA';
    else if (reasons.some((r) => r.severity === 'no-go')) verdict = 'NO-GO';
    else if (reasons.some((r) => r.severity === 'marginal')) verdict = 'MARGINAL';

    if (verdict === 'GO') {
      reasons.push(reason('ok', 'all_clear', 'Ceilings, visibility, and winds are at or above your minimums at both endpoints, with no route hazards returned.'));
    }

    return { verdict, reasons };
  }

  return { STANDARD_MINIMUMS, parseWind, endpointWeatherReasons, computeVerdict };
});
