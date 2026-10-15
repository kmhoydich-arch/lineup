import { fetchJson } from "@/lib/http";

const TTL_MS = 20 * 60 * 1000;
const ACCEPT = "application/geo+json";

/** Isla Vista and Goleta breaks that take wind from KSBA and the LOX grid. */
export const IV_GOLETA_SPOTS = new Set([
  "sands",
  "campus-point",
  "depressions",
  "coal-oil-point",
  "goleta-beach",
  "haskells",
]);

export type TimedValue = { validTime: string; value: number | null };

export type SpeedUnit = "kmh" | "ms";

export type GridWind = {
  office: string;
  gridId: string;
  gridX: number;
  gridY: number;
  speed: TimedValue[];
  direction: TimedValue[];
  gust: TimedValue[];
  speedUnit: SpeedUnit;
  gustUnit: SpeedUnit | null;
};

export type AirportWind = {
  observedAt: string;
  speedMs: number;
  dir: number;
  gustMs: number | null;
};

export type IvWind = {
  airport: AirportWind | null;
  grid: GridWind | null;
};

type CacheEntry<T> = { at: number; value: T };
let airportCache: CacheEntry<AirportWind | null> | null = null;
let airportInflight: Promise<AirportWind | null> | null = null;
const gridCache = new Map<string, CacheEntry<GridWind>>();
const gridInflight = new Map<string, Promise<GridWind>>();

export function parseSpeedUnit(unitCode: string | undefined): SpeedUnit | null {
  if (!unitCode) return null;
  if (unitCode.includes("km_h")) return "kmh";
  if (unitCode.includes("m_s")) return "ms";
  return null;
}

export function toMetersPerSecond(value: number, unit: SpeedUnit): number {
  return unit === "kmh" ? value / 3.6 : value;
}

export function parseValidInterval(validTime: string): { start: number; end: number } | null {
  const [startRaw, spanRaw] = validTime.split("/");
  if (!startRaw || !spanRaw) return null;
  const start = Date.parse(startRaw);
  if (!Number.isFinite(start)) return null;
  if (spanRaw.startsWith("P")) {
    const match = spanRaw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
    if (!match) return null;
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    const span = ((hours * 60 + minutes) * 60 + seconds) * 1000;
    if (span <= 0) return null;
    return { start, end: start + span };
  }
  const end = Date.parse(spanRaw);
  if (!Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

/** Value in effect at an instant. Overlaps use the interval that started latest. */
export function valueAt(values: TimedValue[], instantMs: number): number | null {
  let best: { start: number; value: number } | null = null;
  for (const row of values) {
    if (row.value == null || !Number.isFinite(row.value)) continue;
    const interval = parseValidInterval(row.validTime);
    if (!interval) continue;
    if (instantMs < interval.start || instantMs >= interval.end) continue;
    if (!best || interval.start >= best.start) best = { start: interval.start, value: row.value };
  }
  return best?.value ?? null;
}

export function windAt(
  grid: GridWind,
  instantMs: number,
): { speedMs: number; dir: number; gustMs: number | null } | null {
  const speed = valueAt(grid.speed, instantMs);
  const dir = valueAt(grid.direction, instantMs);
  if (speed == null || dir == null) return null;
  const gust = valueAt(grid.gust, instantMs);
  return {
    speedMs: toMetersPerSecond(speed, grid.speedUnit),
    dir,
    gustMs: gust == null || !grid.gustUnit ? null : toMetersPerSecond(gust, grid.gustUnit),
  };
}

export function describeLocalWind(input: {
  airportUsed: boolean;
  airportAt: string | null;
  airportMissing: boolean;
  airportStale: boolean;
  grid: { office: string; gridId: string; gridX: number; gridY: number } | null;
  gridHours: number;
  openMeteoHours: number;
}): string {
  const parts: string[] = [];
  if (input.airportUsed && input.airportAt) {
    parts.push(`Wind for the current hour is the KSBA Santa Barbara Airport observation at ${input.airportAt}.`);
  } else if (input.airportStale) {
    parts.push("The latest KSBA observation was more than three hours old, so it is not used as the current wind.");
  } else if (input.airportMissing) {
    parts.push("KSBA didn't return a wind speed.");
  }
  if (input.grid && input.gridHours > 0) {
    parts.push(
      `Forecast wind is the NWS ${input.grid.office} grid ${input.grid.gridId} ${input.grid.gridX},${input.grid.gridY}.`,
    );
  } else if (!input.grid) {
    parts.push("The NWS grid didn't load.");
  }
  if (input.openMeteoHours > 0) {
    parts.push(
      input.gridHours > 0
        ? "Hours the airport and the grid don't cover stay on Open-Meteo."
        : "Wind falls back to Open-Meteo.",
    );
  }
  return parts.join(" ") || "Wind is the Open-Meteo forecast.";
}

export async function loadIvWind(lat: number, lon: number): Promise<IvWind> {
  const [airport, grid] = await Promise.all([
    loadAirport().catch(() => null),
    loadGrid(lat, lon).catch(() => null),
  ]);
  return { airport, grid };
}

async function loadAirport(): Promise<AirportWind | null> {
  if (airportCache && Date.now() - airportCache.at < TTL_MS) return airportCache.value;
  if (airportInflight) return airportInflight;
  airportInflight = fetchAirport()
    .then((value) => {
      airportCache = { at: Date.now(), value };
      airportInflight = null;
      return value;
    })
    .catch((error: unknown) => {
      airportInflight = null;
      throw error;
    });
  return airportInflight;
}

async function fetchAirport(): Promise<AirportWind | null> {
  const data = (await fetchJson(
    "https://api.weather.gov/stations/KSBA/observations/latest",
    ACCEPT,
  )) as { properties?: Record<string, unknown> };
  return parseAirport(data.properties ?? null);
}

export function parseAirport(properties: Record<string, unknown> | null): AirportWind | null {
  if (!properties) return null;
  const observedAt = typeof properties.timestamp === "string" ? properties.timestamp : null;
  const speed = quantity(properties.windSpeed);
  if (!observedAt || !speed || Number.isNaN(Date.parse(observedAt))) return null;
  const unit = parseSpeedUnit(speed.unitCode);
  if (!unit || speed.value == null) return null;
  const direction = quantity(properties.windDirection);
  const gust = quantity(properties.windGust);
  const gustUnit = gust ? parseSpeedUnit(gust.unitCode) : null;
  return {
    observedAt,
    speedMs: toMetersPerSecond(speed.value, unit),
    dir: direction?.value ?? 0,
    gustMs: gust?.value == null || !gustUnit ? null : toMetersPerSecond(gust.value, gustUnit),
  };
}

function quantity(value: unknown): { unitCode?: string; value: number | null } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { unitCode?: unknown; value?: unknown };
  const numeric = typeof row.value === "number" && Number.isFinite(row.value) ? row.value : null;
  return {
    unitCode: typeof row.unitCode === "string" ? row.unitCode : undefined,
    value: numeric,
  };
}

async function loadGrid(lat: number, lon: number): Promise<GridWind> {
  const pointUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const point = (await fetchJson(pointUrl, ACCEPT)) as { properties?: Record<string, unknown> };
  const properties = point.properties ?? {};
  const office = typeof properties.cwa === "string" ? properties.cwa : "LOX";
  const gridId = typeof properties.gridId === "string" ? properties.gridId : office;
  const gridX = typeof properties.gridX === "number" ? properties.gridX : null;
  const gridY = typeof properties.gridY === "number" ? properties.gridY : null;
  const forecastUrl = typeof properties.forecastGridData === "string" ? properties.forecastGridData : null;
  if (gridX == null || gridY == null || !forecastUrl) {
    throw new Error("NWS points response had no grid");
  }
  const key = `${gridId}/${gridX},${gridY}`;
  const hit = gridCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const pending = gridInflight.get(key);
  if (pending) return pending;
  const promise = fetchGrid(forecastUrl, office, gridId, gridX, gridY)
    .then((value) => {
      gridCache.set(key, { at: Date.now(), value });
      gridInflight.delete(key);
      return value;
    })
    .catch((error: unknown) => {
      gridInflight.delete(key);
      throw error;
    });
  gridInflight.set(key, promise);
  return promise;
}

async function fetchGrid(
  url: string,
  office: string,
  gridId: string,
  gridX: number,
  gridY: number,
): Promise<GridWind> {
  const data = (await fetchJson(url, ACCEPT)) as { properties?: Record<string, unknown> };
  const properties = data.properties ?? {};
  const speed = series(properties.windSpeed);
  const direction = series(properties.windDirection);
  const gust = series(properties.windGust);
  const speedUnit = parseSpeedUnit(speed.unitCode);
  if (!speedUnit) throw new Error("NWS wind speed unit was not km/h or m/s");
  return {
    office,
    gridId,
    gridX,
    gridY,
    speed: speed.values,
    direction: direction.values,
    gust: gust.values,
    speedUnit,
    gustUnit: parseSpeedUnit(gust.unitCode),
  };
}

function series(value: unknown): { unitCode?: string; values: TimedValue[] } {
  if (!value || typeof value !== "object") return { values: [] };
  const row = value as { uom?: unknown; values?: unknown };
  const values = Array.isArray(row.values)
    ? row.values.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { validTime?: unknown; value?: unknown };
        if (typeof entry.validTime !== "string") return [];
        const numeric = typeof entry.value === "number" && Number.isFinite(entry.value) ? entry.value : null;
        return [{ validTime: entry.validTime, value: numeric }];
      })
    : [];
  return { unitCode: typeof row.uom === "string" ? row.uom : undefined, values };
}
