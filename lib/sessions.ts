import { localHourKey } from "@/lib/time";
import type { DerivedHour } from "@/lib/types";

export const BODY_HEIGHTS = ["knee", "waist", "chest", "head", "overhead"] as const;
export const WIND_FEELS = ["glassy", "offshore", "sideshore", "onshore", "blown"] as const;

export type BodyHeight = (typeof BODY_HEIGHTS)[number];
export type WindFeel = (typeof WIND_FEELS)[number];

export type SessionEntry = {
  id: string;
  /** UTC instant the surfer was in the water. */
  time: string;
  spotId: string;
  height: BodyHeight;
  windFeel: WindFeel;
  worthIt: boolean;
};

export type SessionModel = {
  timeLocal: string;
  faceFt: number;
  score: number;
  swellM: number;
  periodS: number;
  dirDeg: number;
  windMs: number;
  waveSource: string;
};

const CSV_HEADERS = [
  "time_utc",
  "spot_id",
  "spot_name",
  "body_height",
  "wind_feel",
  "worth_it",
  "model_time_local",
  "model_face_ft",
  "model_score",
  "model_swell_m",
  "model_period_s",
  "model_dir_deg",
  "model_wind_ms",
  "model_wave_source",
] as const;

export function isBodyHeight(value: unknown): value is BodyHeight {
  return typeof value === "string" && (BODY_HEIGHTS as readonly string[]).includes(value);
}

export function isWindFeel(value: unknown): value is WindFeel {
  return typeof value === "string" && (WIND_FEELS as readonly string[]).includes(value);
}

export function parseSessionEntries(raw: unknown): SessionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSessionEntry);
}

function isSessionEntry(value: unknown): value is SessionEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as SessionEntry;
  return (
    typeof row.id === "string" &&
    typeof row.time === "string" &&
    Number.isFinite(Date.parse(row.time)) &&
    typeof row.spotId === "string" &&
    isBodyHeight(row.height) &&
    isWindFeel(row.windFeel) &&
    typeof row.worthIt === "boolean"
  );
}

export function matchSessionHour(
  entry: SessionEntry,
  hours: DerivedHour[],
  timeZone: string,
): DerivedHour | null {
  const key = localHourKey(new Date(entry.time), timeZone);
  return hours.find((hour) => hour.time.slice(0, 16) === key) ?? null;
}

export function modelFromHour(hour: DerivedHour): SessionModel {
  return {
    timeLocal: hour.time,
    faceFt: hour.faceFt,
    score: hour.score,
    swellM: hour.swellHeightM,
    periodS: hour.swellPeriodS,
    dirDeg: hour.swellDir,
    windMs: hour.windSpeedMs,
    waveSource: hour.waveSource,
  };
}

export function sessionsToCsv(
  rows: { entry: SessionEntry; spotName: string; model: SessionModel | null }[],
): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    const model = row.model;
    lines.push(
      [
        csvCell(row.entry.time),
        csvCell(row.entry.spotId),
        csvCell(row.spotName),
        csvCell(row.entry.height),
        csvCell(row.entry.windFeel),
        row.entry.worthIt ? "yes" : "no",
        csvCell(model?.timeLocal ?? ""),
        model ? model.faceFt.toFixed(2) : "",
        model ? String(model.score) : "",
        model ? model.swellM.toFixed(2) : "",
        model ? model.periodS.toFixed(1) : "",
        model ? String(Math.round(model.dirDeg)) : "",
        model ? model.windMs.toFixed(2) : "",
        csvCell(model?.waveSource ?? ""),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
