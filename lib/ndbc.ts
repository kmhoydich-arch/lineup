import { haversineKm } from "@/lib/geo";
import { fetchText } from "@/lib/http";
import type { BuoyObservation } from "@/lib/types";

const TTL_MS = 20 * 60 * 1000;
const MAX_KM = 180;
const MAX_TRIES = 8;
const FRESH_MINUTES = 360;

export type NdbcStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
};

export type BuoyCandidate = NdbcStation & { distanceKm: number };

export type ReadingStatus = "ok" | "stale" | "no-waves" | "down";

export type BuoyChoice = {
  chosen: BuoyCandidate | null;
  skipped: { id: string; name: string; distanceKm: number; reason: string }[];
  needsMore: boolean;
  nextId: string | null;
};

type StationCache = { at: number; stations: NdbcStation[] };
let stationCache: StationCache | null = null;
let stationInflight: Promise<NdbcStation[]> | null = null;

type ReadingCache = { at: number; reading: Omit<BuoyObservation, "id" | "name" | "distanceKm"> | null };
const readingCache = new Map<string, ReadingCache>();
const readingInflight = new Map<string, Promise<Omit<BuoyObservation, "id" | "name" | "distanceKm"> | null>>();

export function parseActiveStations(xml: string): NdbcStation[] {
  const stations: NdbcStation[] = [];
  const tags = xml.matchAll(/<station\s+([^>]*?)\s*\/?>/g);
  for (const tag of tags) {
    const attrs = Object.fromEntries(
      [...tag[1].matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
    );
    const lat = Number(attrs.lat);
    const lon = Number(attrs.lon);
    if (!attrs.id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stations.push({
      id: attrs.id,
      name: (attrs.name || attrs.id).replace(/\s+/g, " ").trim(),
      lat,
      lon,
      type: attrs.type || "",
    });
  }
  return stations;
}

export function nearestBuoys(
  stations: NdbcStation[],
  lat: number,
  lon: number,
  maxKm = MAX_KM,
  limit = MAX_TRIES,
): BuoyCandidate[] {
  return stations
    .filter((station) => station.type === "buoy")
    .map((station) => ({ ...station, distanceKm: haversineKm(lat, lon, station.lat, station.lon) }))
    .filter((station) => station.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export function classifyReading(
  reading: { waveHeightM: number | null; ageMinutes: number } | null,
  maxAgeMin = FRESH_MINUTES,
): ReadingStatus {
  if (!reading) return "down";
  if (reading.waveHeightM == null) return "no-waves";
  if (reading.ageMinutes > maxAgeMin) return "stale";
  return "ok";
}

function reasonFor(status: ReadingStatus): string {
  if (status === "stale") return "last wave report is older than 6 hours";
  if (status === "no-waves") return "no wave height in the last 6 hours";
  return "didn't respond";
}

/** Walk nearest-first. `needsMore` means the next station has not been checked yet. */
export function selectBuoy(ordered: BuoyCandidate[], status: Record<string, ReadingStatus>): BuoyChoice {
  const skipped: BuoyChoice["skipped"] = [];
  for (const station of ordered) {
    const state = status[station.id];
    if (!state) {
      return { chosen: null, skipped, needsMore: true, nextId: station.id };
    }
    if (state === "ok") {
      return { chosen: station, skipped, needsMore: false, nextId: null };
    }
    skipped.push({
      id: station.id,
      name: station.name,
      distanceKm: station.distanceKm,
      reason: reasonFor(state),
    });
  }
  return { chosen: null, skipped, needsMore: false, nextId: null };
}

export function describeBuoyChoice(
  chosen: BuoyCandidate | null,
  skipped: BuoyChoice["skipped"],
): string {
  if (!chosen) {
    if (!skipped.length) {
      return `No NDBC or CDIP buoy was listed within ${MAX_KM} km of this break.`;
    }
    const tried = skipped
      .map((station) => `${station.name} (${station.id}, ${Math.round(station.distanceKm)} km, ${station.reason})`)
      .join("; ");
    return `No buoy within ${MAX_KM} km reported wave height in the last 6 hours. Checked ${tried}.`;
  }
  const closer = skipped.filter((station) => station.distanceKm < chosen.distanceKm);
  const closerText = closer.length
    ? ` Closer stations were not used: ${closer
        .map((station) => `${station.name} (${station.id}, ${Math.round(station.distanceKm)} km, ${station.reason})`)
        .join("; ")}.`
    : "";
  return `${chosen.name} (${chosen.id}) is the nearest buoy reporting waves right now, ${Math.round(chosen.distanceKm)} km from this break.${closerText}`;
}

export function parseBuoy(text: string): Omit<BuoyObservation, "id" | "name" | "distanceKm"> | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLine = lines.find((line) => line.startsWith("#YY"));
  const dataLines = lines.filter((line) => !line.startsWith("#"));
  if (!headerLine || !dataLines.length) return null;
  const headers = headerLine.replace(/^#/, "").trim().split(/\s+/);
  const parsed = dataLines
    .map((line) => parseBuoyRow(headers, line))
    .filter((row): row is Omit<BuoyObservation, "id" | "name" | "distanceKm"> => row != null);
  if (!parsed.length) return null;
  const withWaves = parsed.find((row) => row.waveHeightM != null && row.ageMinutes <= FRESH_MINUTES);
  return withWaves ?? parsed[0];
}

function parseBuoyRow(
  headers: string[],
  dataLine: string,
): Omit<BuoyObservation, "id" | "name" | "distanceKm"> | null {
  const cols = dataLine.split(/\s+/);
  const read = (name: string) => {
    const index = headers.indexOf(name);
    if (index < 0 || index >= cols.length) return null;
    if (cols[index] === "MM") return null;
    const value = Number(cols[index]);
    return Number.isFinite(value) ? value : null;
  };
  const yearRaw = read("YY");
  const month = read("MM");
  const day = read("DD");
  const hour = read("hh");
  const minute = read("mm");
  if (yearRaw == null || month == null || day == null || hour == null || minute == null) return null;
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const observed = Date.UTC(year, month - 1, day, hour, minute);
  return {
    observedAt: new Date(observed).toISOString(),
    ageMinutes: (Date.now() - observed) / 60000,
    waveHeightM: read("WVHT"),
    periodS: read("DPD"),
    direction: read("MWD"),
    windSpeedMs: read("WSPD"),
    windDir: read("WDIR"),
    gustMs: read("GST"),
    waterTempC: read("WTMP"),
    airTempC: read("ATMP"),
  };
}

export async function loadNearestWaveBuoy(
  lat: number,
  lon: number,
): Promise<{ buoy: BuoyObservation | null; note: string }> {
  try {
    const stations = await loadStations();
    const ordered = nearestBuoys(stations, lat, lon);
    const status: Record<string, ReadingStatus> = {};
    const readings = new Map<string, Omit<BuoyObservation, "id" | "name" | "distanceKm"> | null>();
    let choice = selectBuoy(ordered, status);
    while (choice.needsMore && choice.nextId) {
      const reading = await loadReading(choice.nextId);
      readings.set(choice.nextId, reading);
      status[choice.nextId] = classifyReading(reading);
      choice = selectBuoy(ordered, status);
    }
    const note = describeBuoyChoice(choice.chosen, choice.skipped);
    if (!choice.chosen) return { buoy: null, note };
    const reading = readings.get(choice.chosen.id);
    if (!reading) return { buoy: null, note };
    return {
      buoy: {
        ...reading,
        id: choice.chosen.id,
        name: choice.chosen.name,
        distanceKm: choice.chosen.distanceKm,
      },
      note,
    };
  } catch {
    return {
      buoy: null,
      note: "The buoy station list didn't load, so there is no live wave buoy for this break.",
    };
  }
}

async function loadStations(): Promise<NdbcStation[]> {
  if (stationCache && Date.now() - stationCache.at < TTL_MS) return stationCache.stations;
  if (stationInflight) return stationInflight;
  stationInflight = fetchText("https://www.ndbc.noaa.gov/activestations.xml")
    .then((xml) => {
      const stations = parseActiveStations(xml);
      stationCache = { at: Date.now(), stations };
      stationInflight = null;
      return stations;
    })
    .catch((error: unknown) => {
      stationInflight = null;
      throw error;
    });
  return stationInflight;
}

async function loadReading(
  id: string,
): Promise<Omit<BuoyObservation, "id" | "name" | "distanceKm"> | null> {
  const hit = readingCache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.reading;
  const pending = readingInflight.get(id);
  if (pending) return pending;
  const promise = fetchText(`https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`)
    .then((text) => parseBuoy(text))
    .catch(() => null)
    .then((reading) => {
      readingCache.set(id, { at: Date.now(), reading });
      readingInflight.delete(id);
      return reading;
    });
  readingInflight.set(id, promise);
  return promise;
}

export async function loadFixedBuoyReading(
  id: string,
): Promise<Omit<BuoyObservation, "id" | "name" | "distanceKm"> | null> {
  return loadReading(id);
}
