"use client";

import { useSyncExternalStore, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnits } from "@/components/providers";
import { formatFacePrecise, formatSpeed, formatSwellHeight } from "@/lib/format";
import { compassPoint } from "@/lib/geo";
import { getSpot } from "@/lib/spots";
import {
  BODY_HEIGHTS,
  matchSessionHour,
  modelFromHour,
  sessionsToCsv,
  WIND_FEELS,
  type BodyHeight,
  type SessionEntry,
  type WindFeel,
} from "@/lib/sessions";
import { clockLabel, formatZonedTime } from "@/lib/time";
import type { DerivedHour, Spot } from "@/lib/types";

const STORAGE_KEY = "lineup-sessions";
const EMPTY: SessionEntry[] = [];
const MAX_ENTRIES = 500;

const listeners = new Set<() => void>();
let snapshot: SessionEntry[] = EMPTY;
let hydrated = false;

function readEntries(): SessionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    const entries = parsed.filter(isStoredEntry);
    return entries.length ? entries : EMPTY;
  } catch {
    return EMPTY;
  }
}

function isStoredEntry(value: unknown): value is SessionEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as SessionEntry;
  return (
    typeof row.id === "string" &&
    typeof row.time === "string" &&
    typeof row.spotId === "string" &&
    (BODY_HEIGHTS as readonly string[]).includes(row.height) &&
    (WIND_FEELS as readonly string[]).includes(row.windFeel) &&
    typeof row.worthIt === "boolean"
  );
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  snapshot = readEntries();
  hydrated = true;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== STORAGE_KEY) return;
    hydrated = false;
    hydrate();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getEntries() {
  hydrate();
  return snapshot;
}

function write(next: SessionEntry[]) {
  snapshot = next.length ? next : EMPTY;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  emit();
}

function addEntry(entry: SessionEntry) {
  const next = [entry, ...getEntries()].slice(0, MAX_ENTRIES);
  write(next);
}

function removeEntry(id: string) {
  write(getEntries().filter((entry) => entry.id !== id));
}

function useSessions() {
  return useSyncExternalStore(subscribe, getEntries, () => EMPTY);
}

const HEIGHT_LABEL: Record<BodyHeight, string> = {
  knee: "Knee",
  waist: "Waist",
  chest: "Chest",
  head: "Head",
  overhead: "Overhead",
};

const WIND_LABEL: Record<WindFeel, string> = {
  glassy: "Glassy",
  offshore: "Offshore",
  sideshore: "Sideshore",
  onshore: "Onshore",
  blown: "Blown out",
};

function datetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SessionLog({ spot, hours }: { spot: Spot; hours: DerivedHour[] }) {
  const entries = useSessions();
  const { units } = useUnits();
  const [when, setWhen] = useState(() => datetimeLocalValue(new Date()));
  const [height, setHeight] = useState<BodyHeight>("waist");
  const [windFeel, setWindFeel] = useState<WindFeel>("glassy");
  const [worthIt, setWorthIt] = useState(true);
  const mine = entries.filter((entry) => entry.spotId === spot.id);

  return (
    <section id="session-log" className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-tight">Session log</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Write down what you actually surfed. It stays in this browser. Later these notes can fit a face-height conversion for each break.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-10" disabled={!entries.length} onClick={() => downloadCsv(entries, hours, spot)}>
          Export CSV
        </Button>
      </div>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = new Date(when);
          if (Number.isNaN(parsed.getTime())) return;
          addEntry({
            id: crypto.randomUUID(),
            time: parsed.toISOString(),
            spotId: spot.id,
            height,
            windFeel,
            worthIt,
          });
        }}
      >
        <label className="grid gap-1 text-sm lg:col-span-2">
          <span className="text-muted-foreground">Time</span>
          <Input className="min-h-10" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Height</span>
          <select className={selectClass} value={height} onChange={(event) => setHeight(event.target.value as BodyHeight)}>
            {BODY_HEIGHTS.map((option) => (
              <option key={option} value={option}>
                {HEIGHT_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Wind felt</span>
          <select className={selectClass} value={windFeel} onChange={(event) => setWindFeel(event.target.value as WindFeel)}>
            {WIND_FEELS.map((option) => (
              <option key={option} value={option}>
                {WIND_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={worthIt} onChange={(event) => setWorthIt(event.target.checked)} />
          Worth it
        </label>
        <Button type="submit" className="min-h-10 self-end">
          Save session
        </Button>
      </form>

      {mine.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No sessions at {spot.name} yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {mine.map((entry) => {
            const hour = matchSessionHour(entry, hours, spot.timezone);
            return (
              <li key={entry.id} className="rounded-xl bg-secondary/70 px-3 py-3 text-sm leading-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {formatZonedTime(entry.time, spot.timezone)} · {HEIGHT_LABEL[entry.height]} · {WIND_LABEL[entry.windFeel]} ·{" "}
                    {entry.worthIt ? "Worth it" : "Not worth it"}
                  </p>
                  <button type="button" className="text-sea underline-offset-4 hover:underline" onClick={() => removeEntry(entry.id)}>
                    Remove
                  </button>
                </div>
                {hour ? (
                  <p className="text-muted-foreground">
                    Model at {clockLabel(hour.time)}: {formatFacePrecise(hour.faceFt, units)} face, score {hour.score}, swell{" "}
                    {formatSwellHeight(hour.swellHeightM, units)} at {Math.round(hour.swellPeriodS)}s from the {compassPoint(hour.swellDir)}, wind{" "}
                    {formatSpeed(hour.windSpeedMs, units)}. {sourceWords(hour.waveSource)}
                  </p>
                ) : (
                  <p className="text-muted-foreground">No model hour in this forecast lines up with that time.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function sourceWords(source: DerivedHour["waveSource"]): string {
  if (source === "mop") return "Height from CDIP MOP.";
  if (source === "shadow") return "Height from the channel-shadow estimate.";
  return "Height from the offshore model.";
}

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function downloadCsv(entries: SessionEntry[], hours: DerivedHour[], spot: Spot) {
  const rows = entries.map((entry) => {
    const name = getSpot(entry.spotId)?.name ?? entry.spotId;
    const hour = entry.spotId === spot.id ? matchSessionHour(entry, hours, spot.timezone) : null;
    return { entry, spotName: name, model: hour ? modelFromHour(hour) : null };
  });
  const csv = sessionsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lineup-sessions.csv";
  link.click();
  URL.revokeObjectURL(url);
}
