import { io } from "next/cache";
import { haversineKm, offsetByBearing } from "@/lib/geo";
import { fetchJson } from "@/lib/http";
import { describeMopUse, loadMopSeries, MOP_TRANSECTS, pickMopSample, type MopSample } from "@/lib/mop";
import { loadFixedBuoyReading, loadNearestWaveBuoy } from "@/lib/ndbc";
import { describeLocalWind, IV_GOLETA_SPOTS, loadIvWind, windAt, type IvWind } from "@/lib/nws";
import { chooseSwell, evaluateConditions, WINDSEA_FACE_DISCOUNT } from "@/lib/rating";
import { getSpot } from "@/lib/spots";
import {
  addLocalHours,
  localClockMinutes,
  formatZonedTime,
  localHourKey,
  shiftLocalClock,
  todayInZone,
  ymdCompact,
  zonedStampToUtc,
} from "@/lib/time";
import type {
  BuoyObservation,
  DayForecast,
  DerivedHour,
  Forecast,
  NowSnapshot,
  Spot,
  SwellSource,
  TideExtreme,
  TideLink,
  TideStage,
  TideTrend,
} from "@/lib/types";
const TTL_MS = 20 * 60 * 1000;
const MARINE_HOURLY = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "secondary_swell_wave_height",
  "secondary_swell_wave_direction",
  "secondary_swell_wave_period",
  "wind_wave_height",
  "wind_wave_direction",
  "wind_wave_period",
  "sea_surface_temperature",
].join(",");
const WEATHER_HOURLY = [
  "temperature_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "weather_code",
  "precipitation_probability",
].join(",");

type CacheEntry = { at: number; value: Forecast };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Forecast>>();

type Series = {
  time: string[];
  [key: string]: (number | null)[] | string[];
};

export class ForecastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForecastError";
  }
}

export function clearForecastCache(id?: string) {
  if (id) cache.delete(id);
  else cache.clear();
}

export async function getForecast(id: string, options?: { fresh?: boolean }): Promise<Forecast> {
  await io();
  const spot = getSpot(id);
  if (!spot) throw new ForecastError("That break isn't in the lineup.");

  if (!options?.fresh) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return retargetNow(hit.value);
    const pending = inflight.get(id);
    if (pending) return pending.then(retargetNow);
  }

  const pending = loadForecast(spot)
    .then((value) => {
      cache.set(id, { at: Date.now(), value });
      inflight.delete(id);
      return value;
    })
    .catch((error: unknown) => {
      inflight.delete(id);
      throw error;
    });

  if (!options?.fresh) inflight.set(id, pending);
  return pending.then(retargetNow);
}

export function toSnapshot(forecast: Forecast): NowSnapshot {
  const hour = forecast.hours[forecast.nowIndex] ?? forecast.hours[0];
  return {
    faceFt: hour.faceFt,
    score: hour.score,
    rating: hour.rating,
    windType: hour.windType,
    windSpeedMs: hour.windSpeedMs,
    windDir: hour.windDir,
    swellDir: hour.swellDir,
    swellPeriodS: hour.swellPeriodS,
    swellHeightM: hour.swellHeightM,
    swellSource: hour.swellSource,
    tideStage: hour.tideStage,
    fetchedAt: forecast.fetchedAt,
  };
}

function retargetNow(forecast: Forecast): Forecast {
  const key = localHourKey(new Date(), forecast.timezone);
  let nowIndex = forecast.hours.findIndex((hour) => hour.time.slice(0, 16) === key);
  if (nowIndex < 0) {
    nowIndex = forecast.hours.findLastIndex((hour) => hour.time.slice(0, 16) <= key);
  }
  if (nowIndex < 0) nowIndex = 0;
  const today = todayInZone(forecast.timezone);
  if (nowIndex === forecast.nowIndex && today === forecast.today) return forecast;
  return { ...forecast, nowIndex, today };
}

async function loadForecast(spot: Spot): Promise<Forecast> {
  const transect = spot.channel ? MOP_TRANSECTS[spot.id] : undefined;
  const marinePromise = loadMarine(spot);
  const weatherPromise = loadWeather(spot);
  const tidePromise = spot.tide ? loadTide(spot) : Promise.resolve(null);
  const buoyPromise = spot.channel
    ? loadNearestWaveBuoy(spot.lat, spot.lon)
    : spot.buoy
      ? loadBuoy(spot)
      : Promise.resolve({ buoy: null as BuoyObservation | null, note: defaultBuoyNote(spot) });
  const mopPromise = transect
    ? loadMopSeries(transect.id).then(
        (samples) => samples,
        () => null,
      )
    : Promise.resolve(null);
  const windPromise = IV_GOLETA_SPOTS.has(spot.id)
    ? loadIvWind(spot.lat, spot.lon).then(
        (wind) => wind,
        () => null,
      )
    : Promise.resolve(null);

  const marine = await marinePromise;
  const [weather, tideResult, buoyResult, mopSeries, localWind] = await Promise.all([
    weatherPromise,
    tidePromise,
    buoyPromise,
    mopPromise,
    windPromise,
  ]);

  const weatherByTime = indexSeries(weather.hourly);
  const hours: DerivedHour[] = [];

  marine.hourly.time.forEach((time, index) => {
    const weatherHour = weatherByTime.get(time.slice(0, 16));
    if (!weatherHour) return;
    const swellH = column(marine.hourly, "swell_wave_height", index);
    const swellP = column(marine.hourly, "swell_wave_period", index);
    const swellD = column(marine.hourly, "swell_wave_direction", index);
    const secondH = column(marine.hourly, "secondary_swell_wave_height", index);
    const secondP = column(marine.hourly, "secondary_swell_wave_period", index);
    const secondD = column(marine.hourly, "secondary_swell_wave_direction", index);
    const windH = column(marine.hourly, "wind_wave_height", index);
    const windP = column(marine.hourly, "wind_wave_period", index);
    const windD = column(marine.hourly, "wind_wave_direction", index);
    const windSpeed = num(weatherHour.wind_speed_10m);
    if (windSpeed == null) return;

    const primary =
      swellH != null && swellP != null && swellD != null
        ? { heightM: swellH, periodS: swellP, dir: swellD, source: "primary" as const }
        : null;
    const secondary =
      secondH != null && secondP != null && secondD != null
        ? { heightM: secondH, periodS: secondP, dir: secondD, source: "secondary" as const }
        : null;
    const windsea =
      windH != null && windP != null && windD != null
        ? { heightM: windH, periodS: windP, dir: windD, source: "windsea" as const }
        : null;
    const channel = spot.channel ? { lon: spot.lon, window: spot.channel } : null;
    const chosen = chooseSwell(spot.facing, primary, secondary, windsea, channel);
    if (!chosen) return;

    const tideM = tideResult ? tideAt(tideResult.points, localClockMinutes(time)) : null;
    const evaluation = evaluateConditions({
      beachFacing: spot.facing,
      breakType: spot.breakType,
      swellHeightM: chosen.swell.heightM,
      swellPeriodS: chosen.swell.periodS,
      swellDir: chosen.swell.dir,
      windSpeedMs: windSpeed,
      windDir: num(weatherHour.wind_direction_10m) ?? chosen.swell.dir,
      tidePosition: null,
      discount: chosen.swell.source === "windsea" ? WINDSEA_FACE_DISCOUNT : 1,
      channel,
    });

    hours.push({
      time,
      ...evaluation,
      faceFt: chosen.faceFt,
      swellHeightM: chosen.swell.heightM,
      swellPeriodS: chosen.swell.periodS,
      swellDir: chosen.swell.dir,
      otherSwellHeightM: chosen.source === "secondary" ? swellH : secondH,
      swellAngle: chosen.angle,
      swellSigned: evaluation.signedAngle,
      swellSource: chosen.source as SwellSource,
      faceDiscount: chosen.swell.source === "windsea" ? WINDSEA_FACE_DISCOUNT : 1,
      channelKind: evaluation.channelKind,
      channelTransmission: evaluation.channelTransmission,
      secondaryHeightM: secondH,
      secondaryPeriodS: secondP,
      secondaryDir: secondD,
      windWaveHeightM: windH,
      windWavePeriodS: windP,
      windWaveDir: windD,
      waveHeightM: column(marine.hourly, "wave_height", index),
      windSpeedMs: windSpeed,
      windGustMs: num(weatherHour.wind_gusts_10m),
      windDir: num(weatherHour.wind_direction_10m) ?? 0,
      windSource: "open-meteo",
      waveSource: spot.channel ? "shadow" : "offshore",
      waveFallback: null,
      mopId: transect?.id ?? null,
      mopKm: transect ? haversineKm(spot.lat, spot.lon, transect.lat, transect.lon) : null,
      mopHsM: null,
      mopTpS: null,
      mopDp: null,
      mopFlag: null,
      tempC: num(weatherHour.temperature_2m),
      precipProb: num(weatherHour.precipitation_probability),
      weatherCode: num(weatherHour.weather_code),
      waterTempC: column(marine.hourly, "sea_surface_temperature", index),
      tideM,
      tideStage: null,
      tideTrend: null,
    });
  });

  if (hours.length < 24) {
    throw new ForecastError(
      "The wave model didn't return a usable day of ocean data for this break. Try again in a minute.",
    );
  }

  const waveNote = transect ? applyMop(hours, spot, transect.id, mopSeries) : null;
  const windNote = IV_GOLETA_SPOTS.has(spot.id) ? applyLocalWind(hours, spot, localWind) : null;
  applyTide(hours, spot);
  const days = buildDays(hours, weather.daily);
  const buoy = buoyResult.buoy;
  const nowWater = hours.find((hour) => hour.waterTempC != null)?.waterTempC ?? null;
  const waterTempC = buoy?.waterTempC ?? nowWater;
  const waterTempSource = buoy?.waterTempC != null ? "buoy" : nowWater != null ? "model" : null;

  const forecast: Forecast = {
    spotId: spot.id,
    fetchedAt: new Date().toISOString(),
    timezone: spot.timezone,
    today: todayInZone(spot.timezone),
    hours,
    days,
    nowIndex: 0,
    buoy,
    buoyNote: buoyResult.note, 
    waveNote,
    windNote,
    tideExtremes: tideResult?.extremes ?? [],
    tideNote: tideResult?.note ?? defaultTideNote(spot),
    waterTempC,
    waterTempSource,
  };
  return retargetNow(forecast);
}

function applyTide(hours: DerivedHour[], spot: Spot) {
  const byDate = new Map<string, DerivedHour[]>();
  for (const hour of hours) {
    const date = hour.time.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(hour);
    byDate.set(date, list);
  }

  for (const dayHours of byDate.values()) {
    const heights = dayHours.map((hour) => hour.tideM).filter((value): value is number => value != null);
    const min = heights.length ? Math.min(...heights) : null;
    const max = heights.length ? Math.max(...heights) : null;
    const range = min != null && max != null ? max - min : 0;
    dayHours.forEach((hour, index) => {
      const next = dayHours[index + 1] ?? hours[hours.indexOf(hour) + 1];
      const position =
        hour.tideM == null || min == null || max == null || range < 0.15
          ? null
          : (hour.tideM - min) / range;
      const evaluation = evaluateConditions({
        beachFacing: spot.facing,
        breakType: spot.breakType,
        swellHeightM: hour.swellHeightM,
        swellPeriodS: hour.swellPeriodS,
        swellDir: hour.swellDir,
        windSpeedMs: hour.windSpeedMs,
        windDir: hour.windDir,
        tidePosition: position,
        discount: hour.faceDiscount,
        channel:
          hour.waveSource === "mop" || !spot.channel
            ? null
            : { lon: spot.lon, window: spot.channel },
      });
      hour.points = evaluation.points;
      hour.rawScore = evaluation.rawScore;
      hour.score = evaluation.score;
      hour.caps = evaluation.caps;
      hour.rating = evaluation.rating;
      hour.faceFt = evaluation.faceFt;
      hour.channelKind = evaluation.channelKind;
      hour.channelTransmission = evaluation.channelTransmission;
      hour.swellAngle = evaluation.angle;
      hour.tideStage = stageFor(position);
      hour.tideTrend = trendFor(hour.tideM, next?.tideM ?? null);
    });
  }
}

function stageFor(position: number | null): TideStage | null {
  if (position == null) return null;
  if (position < 0.33) return "low";
  if (position > 0.66) return "high";
  return "mid";
}

function trendFor(current: number | null, next: number | null): TideTrend | null {
  if (current == null || next == null) return null;
  if (next > current + 0.02) return "rising";
  if (next < current - 0.02) return "falling";
  return "steady";
}

function buildDays(
  hours: DerivedHour[],
  daily: { time: string[]; sunrise: (string | null)[]; sunset: (string | null)[] },
): DayForecast[] {
  const sun = new Map<string, { sunrise: string | null; sunset: string | null }>();
  daily.time.forEach((date, index) => {
    sun.set(date, {
      sunrise: daily.sunrise[index] ?? null,
      sunset: daily.sunset[index] ?? null,
    });
  });

  const grouped = new Map<string, DerivedHour[]>();
  for (const hour of hours) {
    const date = hour.time.slice(0, 10);
    const list = grouped.get(date) ?? [];
    list.push(hour);
    grouped.set(date, list);
  }

  return [...grouped.entries()].map(([date, dayHours]) => {
    const faces = dayHours.map((hour) => hour.faceFt);
    const light = sun.get(date);
    return {
      date,
      sunrise: light?.sunrise ?? null,
      sunset: light?.sunset ?? null,
      window: bestWindow(dayHours, light?.sunrise ?? null, light?.sunset ?? null),
      maxFaceFt: Math.max(...faces),
      minFaceFt: Math.min(...faces),
    };
  });
}

function bestWindow(
  dayHours: DerivedHour[],
  sunrise: string | null,
  sunset: string | null,
): DayForecast["window"] {
  const daylight = dayHours.filter((hour) => overlapsDaylight(hour.time, sunrise, sunset));
  const pool = daylight.length >= 3 ? daylight : dayHours;
  if (pool.length < 3) return null;

  let best: { start: number; score: number; face: number } | null = null;
  for (let index = 0; index <= pool.length - 3; index += 1) {
    const slice = pool.slice(index, index + 3);
    const contiguous = slice.every((hour, offset) => {
      if (offset === 0) return true;
      return localClockMinutes(hour.time) - localClockMinutes(slice[offset - 1].time) === 60;
    });
    if (!contiguous) continue;
    const score = slice.reduce((sum, hour) => sum + hour.score, 0) / slice.length;
    const face = slice.reduce((sum, hour) => sum + hour.faceFt, 0) / slice.length;
    if (
      !best ||
      score > best.score + 0.5 ||
      (Math.abs(score - best.score) <= 0.5 && face > best.face)
    ) {
      best = { start: index, score, face };
    }
  }
  if (!best) return null;
  const slice = pool.slice(best.start, best.start + 3);
  const middle = slice[1];
  return {
    start: slice[0].time,
    end: addLocalHours(slice[2].time, 1),
    score: Math.round(best.score),
    rating: middle.rating,
    faceFt: best.face,
  };
}

function overlapsDaylight(hourIso: string, sunrise: string | null, sunset: string | null): boolean {
  const start = localClockMinutes(hourIso);
  if (!sunrise || !sunset) {
    const hour = Number(hourIso.slice(11, 13));
    return hour >= 6 && hour <= 18;
  }
  return start + 60 > localClockMinutes(sunrise) && start < localClockMinutes(sunset);
}

async function loadMarine(spot: Spot): Promise<{ hourly: Series }> {
  const distances = [6, 14, 24];
  let lastError = "The wave model didn't return ocean data for this break.";
  for (const km of distances) {
    const point = offsetByBearing(spot.lat, spot.lon, spot.facing, km);
    const url = new URL("https://marine-api.open-meteo.com/v1/marine");
    url.searchParams.set("latitude", point.lat.toFixed(4));
    url.searchParams.set("longitude", point.lon.toFixed(4));
    url.searchParams.set("hourly", MARINE_HOURLY);
    url.searchParams.set("forecast_days", "8");
    url.searchParams.set("timezone", spot.timezone);
    try {
      const data = (await fetchJson(url.toString())) as { hourly?: Series; reason?: string };
      const hourly = data.hourly;
      if (!hourly?.time?.length) {
        lastError = data.reason || lastError;
        continue;
      }
      const heights = hourly.swell_wave_height as (number | null)[];
      const nulls = heights.filter((value) => value == null).length;
      if (nulls / heights.length > 0.25) {
        lastError = "The marine grid still looks like land at this point.";
        continue;
      }
      return { hourly };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new ForecastError(
    `The wave model didn't return ocean data for ${spot.name}. ${lastError}`,
  );
}

async function loadWeather(spot: Spot): Promise<{
  hourly: Series;
  daily: { time: string[]; sunrise: (string | null)[]; sunset: (string | null)[] };
}> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", spot.lat.toFixed(4));
  url.searchParams.set("longitude", spot.lon.toFixed(4));
  url.searchParams.set("hourly", WEATHER_HOURLY);
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("forecast_days", "8");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("timezone", spot.timezone);
  try {
    const data = (await fetchJson(url.toString())) as {
      hourly?: Series;
      daily?: { time: string[]; sunrise: (string | null)[]; sunset: (string | null)[] };
      reason?: string;
    };
    if (!data.hourly?.time?.length || !data.daily?.time?.length) {
      throw new ForecastError(data.reason || "The wind forecast came back empty.");
    }
    return { hourly: data.hourly, daily: data.daily };
  } catch (error) {
    if (error instanceof ForecastError) throw error;
    throw new ForecastError("The wind forecast didn't load, so a rating would be a guess. Try again in a minute.");
  }
}

type TidePoint = { mins: number; v: number };

async function loadTide(spot: Spot): Promise<{
  points: TidePoint[];
  extremes: TideExtreme[];
  note: string;
} | null> {
  const link = spot.tide;
  if (!link) return null;
  const stationId = link.referenceId ?? link.id;
  const begin = ymdCompact(spot.timezone, new Date(Date.now() - 36 * 3600 * 1000));
  const end = ymdCompact(spot.timezone, new Date(Date.now() + 9 * 86400 * 1000));
  try {
    const [hourly, hilo] = await Promise.all([
      fetchTide(stationId, begin, end, "h"),
      fetchTide(stationId, begin, end, "hilo").catch(() => [] as { t: string; v: string; type?: string }[]),
    ]);
    if (!hourly.length) throw new Error("empty");
    const shift = averageShift(link);
    const ratio = averageRatio(link);
    const points = hourly
      .map((row) => ({
        mins: localClockMinutes(shiftLocalClock(row.t.replace(" ", "T"), shift)),
        v: Number(row.v) * ratio,
      }))
      .filter((row) => Number.isFinite(row.mins) && Number.isFinite(row.v))
      .sort((a, b) => a.mins - b.mins);
    const extremes = hilo
      .map((row) => ({
        time: shiftLocalClock(row.t, shift),
        heightM: Number(row.v) * ratio,
        kind: row.type === "H" ? ("high" as const) : ("low" as const),
      }))
      .filter((row) => Number.isFinite(row.heightM));
    return { points, extremes, note: tideNote(link, shift, ratio) };
  } catch {
    return {
      points: [],
      extremes: [],
      note: `The tide station ${link.name} (${link.id}) didn't respond. Tide is left neutral in the score.`,
    };
  }
}

async function fetchTide(
  station: string,
  begin: string,
  end: string,
  interval: "h" | "hilo",
): Promise<{ t: string; v: string; type?: string }[]> {
  const url = new URL("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter");
  url.searchParams.set("begin_date", begin);
  url.searchParams.set("end_date", end);
  url.searchParams.set("station", station);
  url.searchParams.set("product", "predictions");
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("time_zone", "lst_ldt");
  url.searchParams.set("interval", interval);
  url.searchParams.set("units", "metric");
  url.searchParams.set("format", "json");
  url.searchParams.set("application", "lineup_surf_forecast");
  const data = (await fetchJson(url.toString())) as {
    predictions?: { t: string; v: string; type?: string }[];
    error?: { message?: string };
  };
  if (data.error) throw new Error(data.error.message || "tide error");
  return data.predictions ?? [];
}

function averageShift(link: TideLink): number {
  if (link.timeOffsetHighMin == null || link.timeOffsetLowMin == null) return 0;
  return (link.timeOffsetHighMin + link.timeOffsetLowMin) / 2;
}

function averageRatio(link: TideLink): number {
  if (link.heightRatioHigh == null || link.heightRatioLow == null) return 1;
  return (link.heightRatioHigh + link.heightRatioLow) / 2;
}

function tideNote(link: TideLink, shift: number, ratio: number): string {
  if (!link.referenceId) {
    return `Hourly predictions from NOAA CO-OPS ${link.name} (${link.id}), datum MLLW.`;
  }
  const minutes = Math.round(shift);
  const sign = minutes > 0 ? "+" : "";
  return `${link.name} is a NOAA subordinate station. Times are shifted ${sign}${minutes} min and heights scaled by ${ratio.toFixed(2)} from ${link.referenceName} (${link.referenceId}). Datum MLLW.`;
}

function tideAt(points: TidePoint[], mins: number): number | null {
  if (!points.length || Number.isNaN(mins)) return null;
  if (mins <= points[0].mins || mins >= points[points.length - 1].mins) {
    const nearest = mins <= points[0].mins ? points[0] : points[points.length - 1];
    if (Math.abs(nearest.mins - mins) > 180) return null;
    return nearest.v;
  }
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (points[mid].mins <= mins) low = mid;
    else high = mid;
  }
  const left = points[low];
  const right = points[high];
  const span = right.mins - left.mins;
  if (span <= 0) return left.v;
  const t = (mins - left.mins) / span;
  return left.v + (right.v - left.v) * t;
}

async function loadBuoy(spot: Spot): Promise<{ buoy: BuoyObservation | null; note: string | null }> {
  const buoy = spot.buoy;
  if (!buoy) return { buoy: null, note: defaultBuoyNote(spot) };
  const parsed = await loadFixedBuoyReading(buoy.id);
  if (!parsed) {
    return { buoy: null, note: joinNote(`${buoy.name} (${buoy.id}) didn't include a readable observation.`, spot.buoyNote) };
  }
  if (parsed.waveHeightM == null || parsed.ageMinutes > 360) {
    const why =
      parsed.waveHeightM == null
        ? `${buoy.name} (${buoy.id}) had no wave height in the latest report.`
        : `${buoy.name} (${buoy.id}) last reported ${Math.round(parsed.ageMinutes / 60)} hours ago, so it isn't treated as live.`;
    return { buoy: null, note: joinNote(why, spot.buoyNote) };
  }
  return {
    buoy: { ...parsed, id: buoy.id, name: buoy.name, distanceKm: null },
    note: spot.buoyNote ?? null,
  };
}

function applyMop(hours: DerivedHour[], spot: Spot, transectId: string, samples: MopSample[] | null): string {
  const km = hours[0]?.mopKm ?? 0;
  if (!samples) {
    for (const hour of hours) hour.waveFallback = "missing";
    return describeMopUse({ id: transectId, km, used: 0, flagged: 0, missing: hours.length, failed: true });
  }
  let used = 0;
  let flagged = 0;
  let missing = 0;
  for (const hour of hours) {
    const instant = zonedStampToUtc(hour.time, spot.timezone);
    if (!instant) {
      hour.waveFallback = "missing";
      missing += 1;
      continue;
    }
    const pick = pickMopSample(samples, instant.getTime() / 1000);
    if (!pick.sample) {
      hour.waveSource = "shadow";
      hour.waveFallback = pick.reason === "flagged" ? "flagged" : "missing";
      hour.mopFlag = pick.flag;
      if (pick.reason === "flagged") flagged += 1;
      else missing += 1;
      continue;
    }
    hour.waveSource = "mop";
    hour.waveFallback = null;
    hour.swellHeightM = pick.sample.hs;
    hour.swellPeriodS = pick.sample.tp;
    hour.swellDir = pick.sample.dp;
    hour.swellSource = "primary";
    hour.faceDiscount = 1;
    hour.mopHsM = pick.sample.hs;
    hour.mopTpS = pick.sample.tp;
    hour.mopDp = pick.sample.dp;
    hour.mopFlag = 1;
    used += 1;
  }
  return describeMopUse({ id: transectId, km, used, flagged, missing, failed: false });
}

const AIRPORT_FRESH_MIN = 180;

function applyLocalWind(hours: DerivedHour[], spot: Spot, wind: IvWind | null): string {
  if (!wind || (!wind.airport && !wind.grid)) {
    return "Santa Barbara Airport and the NWS grid didn't load, so wind is the Open-Meteo forecast.";
  }
  const nowKey = localHourKey(new Date(), spot.timezone);
  const airportAgeMin = wind.airport ? (Date.now() - Date.parse(wind.airport.observedAt)) / 60000 : null;
  const airportFresh =
    wind.airport != null && airportAgeMin != null && airportAgeMin >= -15 && airportAgeMin <= AIRPORT_FRESH_MIN;
  let airportUsed = false;
  let gridHours = 0;
  let openMeteoHours = 0;
  for (const hour of hours) {
    const key = hour.time.slice(0, 16);
    if (airportFresh && wind.airport && key === nowKey) {
      hour.windSpeedMs = wind.airport.speedMs;
      hour.windDir = wind.airport.dir;
      hour.windGustMs = wind.airport.gustMs;
      hour.windSource = "ksba";
      airportUsed = true;
      continue;
    }
    const instant = zonedStampToUtc(hour.time, spot.timezone);
    const sample = wind.grid && instant ? windAt(wind.grid, instant.getTime()) : null;
    if (!sample) {
      openMeteoHours += 1;
      continue;
    }
    hour.windSpeedMs = sample.speedMs;
    hour.windDir = sample.dir;
    hour.windGustMs = sample.gustMs;
    hour.windSource = "nws";
    gridHours += 1;
  }
  return describeLocalWind({
    airportUsed,
    airportAt: wind.airport ? formatZonedTime(wind.airport.observedAt, spot.timezone) : null,
    airportMissing: wind.airport == null,
    airportStale: wind.airport != null && !airportFresh,
    grid: wind.grid,
    gridHours,
    openMeteoHours,
  });
}

function joinNote(note: string, extra?: string): string {
  return extra ? `${note} ${extra}` : note;
}

function defaultBuoyNote(spot: Spot): string | null {
  if (spot.buoy) return null;
  if (spot.coast === "International") {
    return "NOAA buoys don't cover this coast. Swell and wind here are from the Open-Meteo models only.";
  }
  return "No nearby buoy with a fresh wave report is linked, so the swell is model-only.";
}

function defaultTideNote(spot: Spot): string {
  if (spot.coast === "International") {
    return "NOAA tide predictions don't cover this coast, so the tide part of the score stays neutral.";
  }
  return "No tide station is linked, so the tide part of the score stays neutral.";
}

function indexSeries(series: Series): Map<string, Record<string, number | null>> {
  const map = new Map<string, Record<string, number | null>>();
  const keys = Object.keys(series).filter((key) => key !== "time");
  series.time.forEach((time, index) => {
    const row: Record<string, number | null> = {};
    for (const key of keys) {
      const column = series[key] as (number | null)[];
      row[key] = num(column?.[index]);
    }
    map.set(time.slice(0, 16), row);
  });
  return map;
}

function column(series: Series, key: string, index: number): number | null {
  const value = series[key]?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function num(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

