import { fetchText } from "@/lib/http";

const ROOT = "https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore";
const TTL_MS = 20 * 60 * 1000;
const GOOD_FLAG = 1;
const WINDOW_SEC = 90 * 60;
const MAX_FORECAST_GAP_SEC = 6 * 3600;

/**
 * Nearest CDIP MOP v1.1 alongshore prediction site for each channel break.
 * Coordinates were read from the forecast NetCDF metaLatitude/metaLongitude on 2026-10-15.
 */
export const MOP_TRANSECTS: Record<string, { id: string; lat: number; lon: number }> = {
  sands: { id: "B0414", lat: 34.40383, lon: -119.8744 },
  "campus-point": { id: "B0382", lat: 34.40266, lon: -119.84179 },
  depressions: { id: "B0387", lat: 34.40108, lon: -119.85161 },
  "coal-oil-point": { id: "B0416", lat: 34.40334, lon: -119.88145 },
  "goleta-beach": { id: "B0364", lat: 34.4074, lon: -119.83013 },
  haskells: { id: "B0452", lat: 34.42283, lon: -119.91206 },
  "el-capitan": { id: "B0574", lat: 34.45549, lon: -120.02794 },
  refugio: { id: "B0621", lat: 34.45729, lon: -120.07205 },
  leadbetter: { id: "B0229", lat: 34.3992, lon: -119.69394 },
  hammonds: { id: "B0166", lat: 34.41139, lon: -119.63034 },
  "santa-claus-lane": { id: "B0081", lat: 34.3991, lon: -119.55852 },
  rincon: { id: "VE678", lat: 34.36956, lon: -119.47511 },
  "c-street": { id: "VE465", lat: 34.26703, lon: -119.30117 },
};

export type MopKind = "nowcast" | "forecast";

export type MopSample = {
  unix: number;
  hs: number;
  tp: number;
  dp: number;
  flag: number;
  kind: MopKind;
};

export type MopArrays = {
  waveTime: number[];
  waveHs: number[];
  waveTp: number[];
  waveDp: number[];
  waveFlagPrimary: number[];
};

export type MopPick = {
  sample: { hs: number; tp: number; dp: number; kind: MopKind } | null;
  reason: "ok" | "flagged" | "missing";
  flag: number | null;
};

type CacheEntry = { at: number; samples: MopSample[] };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<MopSample[]>>();

export function parseWaveTimeLength(dds: string): number | null {
  const match = dds.match(/waveTime\[waveTime = (\d+)\]/);
  if (!match) return null;
  const length = Number(match[1]);
  return Number.isFinite(length) && length > 0 ? length : null;
}

export function parseMopAscii(text: string): MopArrays {
  const found: Partial<Record<"waveTime" | "waveHs" | "waveTp" | "waveDp" | "waveFlagPrimary", number[]>> = {};
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(waveTime|waveHs|waveTp|waveDp|waveFlagPrimary)\[\d+\]$/);
    if (!match) continue;
    const name = match[1] as "waveTime" | "waveHs" | "waveTp" | "waveDp" | "waveFlagPrimary";
    let cursor = index + 1;
    while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
    const raw = lines[cursor] ?? "";
    found[name] = raw
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));
  }
  return {
    waveTime: found.waveTime ?? [],
    waveHs: found.waveHs ?? [],
    waveTp: found.waveTp ?? [],
    waveDp: found.waveDp ?? [],
    waveFlagPrimary: found.waveFlagPrimary ?? [],
  };
}

export function samplesFromArrays(kind: MopKind, arrays: MopArrays): MopSample[] {
  const count = arrays.waveTime.length;
  const samples: MopSample[] = [];
  for (let index = 0; index < count; index += 1) {
    const unix = arrays.waveTime[index];
    const hs = arrays.waveHs[index];
    const tp = arrays.waveTp[index];
    const dp = arrays.waveDp[index];
    const flag = arrays.waveFlagPrimary[index];
    if (![unix, hs, tp, dp, flag].every((value) => Number.isFinite(value))) continue;
    samples.push({ unix, hs, tp, dp, flag, kind });
  }
  return samples;
}

function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/**
 * Prefer a good nowcast within 90 minutes. Otherwise interpolate a good
 * forecast pair, or use a single good forecast point inside that window.
 * Flag 1 is good. Anything else is a bad flag.
 */
export function pickMopSample(samples: MopSample[], unix: number): MopPick {
  const nowGood = samples
    .filter(
      (sample) =>
        sample.kind === "nowcast" && sample.flag === GOOD_FLAG && Math.abs(sample.unix - unix) <= WINDOW_SEC,
    )
    .sort((a, b) => Math.abs(a.unix - unix) - Math.abs(b.unix - unix));
  if (nowGood.length) {
    const sample = nowGood[0];
    return { sample: { hs: sample.hs, tp: sample.tp, dp: sample.dp, kind: "nowcast" }, reason: "ok", flag: GOOD_FLAG };
  }

  const forecast = samples.filter((sample) => sample.kind === "forecast").sort((a, b) => a.unix - b.unix);
  let previous: MopSample | null = null;
  let next: MopSample | null = null;
  for (const sample of forecast) {
    if (sample.unix <= unix) previous = sample;
    if (sample.unix >= unix && !next) next = sample;
  }
  if (
    previous &&
    next &&
    previous.unix !== next.unix &&
    previous.flag === GOOD_FLAG &&
    next.flag === GOOD_FLAG &&
    next.unix - previous.unix <= MAX_FORECAST_GAP_SEC
  ) {
    const t = (unix - previous.unix) / (next.unix - previous.unix);
    return {
      sample: {
        hs: previous.hs + (next.hs - previous.hs) * t,
        tp: previous.tp + (next.tp - previous.tp) * t,
        dp: lerpAngle(previous.dp, next.dp, t),
        kind: "forecast",
      },
      reason: "ok",
      flag: GOOD_FLAG,
    };
  }

  const goodNear = forecast
    .filter((sample) => sample.flag === GOOD_FLAG && Math.abs(sample.unix - unix) <= WINDOW_SEC)
    .sort((a, b) => Math.abs(a.unix - unix) - Math.abs(b.unix - unix));
  if (goodNear.length) {
    const sample = goodNear[0];
    return { sample: { hs: sample.hs, tp: sample.tp, dp: sample.dp, kind: "forecast" }, reason: "ok", flag: GOOD_FLAG };
  }

  const nearby = samples
    .filter((sample) => Math.abs(sample.unix - unix) <= WINDOW_SEC)
    .sort((a, b) => Math.abs(a.unix - unix) - Math.abs(b.unix - unix));
  if (nearby.length) {
    return { sample: null, reason: "flagged", flag: nearby[0].flag };
  }
  return { sample: null, reason: "missing", flag: null };
}

export function describeMopUse(input: {
  id: string;
  km: number;
  used: number;
  flagged: number;
  missing: number;
  failed: boolean;
}): string {
  const distance = input.km < 10 ? `${input.km.toFixed(1)} km` : `${Math.round(input.km)} km`;
  const credit = `Data from CDIP, Scripps Institution of Oceanography. Transect ${input.id} is the nearest alongshore point, ${distance} from the break. Significant height, period, and direction are shown as CDIP published them. Face height is Lineup's conversion, not a CDIP product.`;
  if (input.failed) {
    return `CDIP MOP didn't return a usable series for transect ${input.id}, so these hours use the channel-shadow estimate. ${credit}`;
  }
  if (input.used === 0) {
    return `CDIP MOP transect ${input.id} had no hour with waveFlagPrimary of 1, so these hours use the channel-shadow estimate. ${credit}`;
  }
  if (input.flagged + input.missing === 0) {
    return `Nearshore height is CDIP MOP transect ${input.id}. waveFlagPrimary was 1. ${credit}`;
  }
  return `Nearshore height is CDIP MOP transect ${input.id} where waveFlagPrimary is 1. Hours with a bad flag or no sample use the channel-shadow estimate, and the table says which. ${credit}`;
}

export async function loadMopSeries(transectId: string): Promise<MopSample[]> {
  const hit = cache.get(transectId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.samples;
  const pending = inflight.get(transectId);
  if (pending) return pending;

  const promise = fetchMopSeries(transectId)
    .then((samples) => {
      cache.set(transectId, { at: Date.now(), samples });
      inflight.delete(transectId);
      return samples;
    })
    .catch((error: unknown) => {
      inflight.delete(transectId);
      throw error;
    });
  inflight.set(transectId, promise);
  return promise;
}

async function fetchMopSeries(transectId: string): Promise<MopSample[]> {
  const [nowcast, forecast] = await Promise.allSettled([
    fetchMopKind(transectId, "nowcast"),
    fetchMopKind(transectId, "forecast"),
  ]);
  const samples: MopSample[] = [];
  if (nowcast.status === "fulfilled") samples.push(...nowcast.value);
  if (forecast.status === "fulfilled") samples.push(...forecast.value);
  if (!samples.length) {
    const reason = nowcast.status === "rejected" ? nowcast.reason : forecast.status === "rejected" ? forecast.reason : "empty";
    throw reason instanceof Error ? reason : new Error("CDIP MOP returned no samples");
  }
  return samples;
}

async function fetchMopKind(transectId: string, kind: MopKind): Promise<MopSample[]> {
  const dds = await fetchText(`${ROOT}/${transectId}_${kind}.nc.dds`);
  const length = parseWaveTimeLength(dds);
  if (!length) throw new Error(`CDIP MOP ${transectId} ${kind} has no waveTime length`);
  const count = kind === "nowcast" ? Math.min(96, length) : Math.min(length, 120);
  const start = length - count;
  const end = length - 1;
  const query = [
    `waveTime[${start}:1:${end}]`,
    `waveHs[${start}:1:${end}]`,
    `waveTp[${start}:1:${end}]`,
    `waveDp[${start}:1:${end}]`,
    `waveFlagPrimary[${start}:1:${end}]`,
  ].join(",");
  const text = await fetchText(`${ROOT}/${transectId}_${kind}.nc.ascii?${query}`);
  return samplesFromArrays(kind, parseMopAscii(text));
}
