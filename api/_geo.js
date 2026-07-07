// Pure geo helpers for the route map payload. No I/O, no throwing.

// Convective-hazard classifier for airsigmet items. Matches the Task-2 logic;
// briefing.js re-imports this so the check lives in exactly one place.
function isConvective(item) {
  const s = `${item.airsigmetType || item.airSigmetType || ''} ${item.hazard || ''} ${item.phenomenon || ''}`.toUpperCase();
  return s.includes('CONVECTIVE') || s.includes('CONV') || /\bTS\b/.test(s);
}

// Spherical (slerp) great-circle interpolation between two {lat, lon} points.
// Returns n+1 points as [lat, lon] pairs, inclusive of both endpoints.
//
// CONUS-focused: the returned longitudes are NOT unwrapped across the
// antimeridian (±180°). A route that crosses 180° longitude (e.g. across the
// Pacific) will produce a polyline that jumps the seam. This is intentional —
// BriefCast targets the contiguous US, where no route crosses the antimeridian.
function greatCircle(from, to, n = 32) {
  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(from.lon) ||
      !Number.isFinite(to.lat) || !Number.isFinite(to.lon)) {
    return [];
  }
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(from.lat), lon1 = toRad(from.lon);
  const lat2 = toRad(to.lat), lon2 = toRad(to.lon);

  const x1 = Math.cos(lat1) * Math.cos(lon1), y1 = Math.cos(lat1) * Math.sin(lon1), z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2) * Math.cos(lon2), y2 = Math.cos(lat2) * Math.sin(lon2), z2 = Math.sin(lat2);

  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
  const ang = Math.acos(dot);
  const sinAng = Math.sin(ang);

  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x, y, z;
    if (sinAng < 1e-9) {
      // Coincident (or antipodal) endpoints: fall back to linear blend so we
      // still emit endpoints exactly and never divide by ~0.
      x = x1 + (x2 - x1) * t;
      y = y1 + (y2 - y1) * t;
      z = z1 + (z2 - z1) * t;
    } else {
      const a = Math.sin((1 - t) * ang) / sinAng;
      const b = Math.sin(t * ang) / sinAng;
      x = a * x1 + b * x2;
      y = a * y1 + b * y2;
      z = a * z1 + b * z2;
    }
    const lat = Math.atan2(z, Math.hypot(x, y));
    const lon = Math.atan2(y, x);
    points.push([toDeg(lat), toDeg(lon)]);
  }
  // Force exact endpoints (guards against float drift in the trig round-trip).
  points[0] = [from.lat, from.lon];
  points[n] = [to.lat, to.lon];
  return points;
}

// Classify an airsigmet item as 'SIGMET' | 'AIRMET' | null. Live AWC responses
// use `airSigmetType` (capital S); older/other shapes use `airsigmetType`.
// The old inline filter in briefing.js only checked the lowercase key, so real
// convective SIGMETs (airSigmetType:'SIGMET', hazard:'CONVECTIVE') matched
// neither array and were silently dropped in production.
function airsigmetKind(item) {
  if (!item) return null;
  const s = String(item.airSigmetType || item.airsigmetType || item.hazard || '').toUpperCase();
  if (s.includes('SIGMET')) return 'SIGMET';
  if (s.includes('AIRMET')) return 'AIRMET';
  return null;
}

// Split a raw airsigmet API response into { sigmets, airmets }. Non-array input
// yields empty arrays; items matching neither kind are dropped.
function splitAirsigmets(raw) {
  const sigmets = [];
  const airmets = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const kind = airsigmetKind(item);
      if (kind === 'SIGMET') sigmets.push(item);
      else if (kind === 'AIRMET') airmets.push(item);
    }
  }
  return { sigmets, airmets };
}

// Extract a polygon ring from an airsigmet item. Real AWC airsigmet responses
// carry geometry as `coords: [{lat, lon}, ...]`. Returns [[lat, lon], ...] with
// only finite points, or null when geometry is missing/malformed. Never throws.
function parseHazardCoords(item) {
  if (!item || !Array.isArray(item.coords)) return null;
  const ring = [];
  for (const pt of item.coords) {
    if (pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lon)) {
      ring.push([pt.lat, pt.lon]);
    }
  }
  // A drawable polygon needs at least 3 vertices; 1-2 points is degenerate
  // geometry (a dot or a line), so treat it as malformed and skip the item.
  return ring.length >= 3 ? ring : null;
}

// Assemble the map payload consumed by the frontend route map (Task 5).
// Returns null when either airport is unknown (no coordinates to draw).
function buildMapPayload({ airportFrom, airportTo, fromCode, toCode, depCategory, destCategory, sigmets = [], airmets = [] }) {
  if (!airportFrom || !airportTo) return null;

  const hazardPolygons = [];
  for (const s of sigmets) {
    const coords = parseHazardCoords(s);
    if (coords) hazardPolygons.push({ kind: isConvective(s) ? 'convective' : 'sigmet', coords });
  }
  for (const a of airmets) {
    const coords = parseHazardCoords(a);
    if (coords) hazardPolygons.push({ kind: isConvective(a) ? 'convective' : 'airmet', coords });
  }

  return {
    from: { icao: airportFrom.icao || fromCode, lat: airportFrom.lat, lon: airportFrom.lon, category: depCategory },
    to: { icao: airportTo.icao || toCode, lat: airportTo.lat, lon: airportTo.lon, category: destCategory },
    route: greatCircle(airportFrom, airportTo, 32),
    hazardPolygons
  };
}

module.exports = { greatCircle, isConvective, parseHazardCoords, buildMapPayload, airsigmetKind, splitAirsigmets };
