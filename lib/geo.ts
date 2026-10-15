const POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

const WORDS: Record<(typeof POINTS)[number], string> = {
  N: "north",
  NNE: "north-northeast",
  NE: "northeast",
  ENE: "east-northeast",
  E: "east",
  ESE: "east-southeast",
  SE: "southeast",
  SSE: "south-southeast",
  S: "south",
  SSW: "south-southwest",
  SW: "southwest",
  WSW: "west-southwest",
  W: "west",
  WNW: "west-northwest",
  NW: "northwest",
  NNW: "north-northwest",
};

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Smallest angle between two compass bearings, 0–180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return d > 180 ? 360 - d : d;
}

/**
 * Signed angle of `fromDeg` relative to `facingDeg`.
 * Positive means the source sits to the right as you look out to sea.
 */
export function signedFromFacing(fromDeg: number, facingDeg: number): number {
  const rel = normalizeDeg(fromDeg - facingDeg);
  return rel > 180 ? rel - 360 : rel;
}

export function compassPoint(deg: number): string {
  const index = Math.round(normalizeDeg(deg) / 22.5) % 16;
  return POINTS[index];
}

export function compassWord(deg: number): string {
  return WORDS[compassPoint(deg) as (typeof POINTS)[number]];
}

/** Great-circle distance in kilometers. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthKm = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Move `km` from a point along a compass bearing (0 = north). */
export function offsetByBearing(
  lat: number,
  lon: number,
  bearingDeg: number,
  km: number,
): { lat: number; lon: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (km / 111.32) * Math.cos(rad);
  const dLon =
    (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad);
  return { lat: lat + dLat, lon: lon + dLon };
}
