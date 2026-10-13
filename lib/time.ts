export function localHourKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour.padStart(2, "0")}:00`;
}

export function todayInZone(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Treat a spot-local clock stamp as a sortable minute count. Not a real UTC instant. */
export function localClockMinutes(stamp: string): number {
  const match = stamp.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return Number.NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return Date.UTC(year, month - 1, day, hour, minute) / 60000;
}

export function shiftLocalClock(stamp: string, minutes: number): string {
  const base = localClockMinutes(stamp);
  if (Number.isNaN(base)) return stamp;
  const shifted = new Date((base + minutes) * 60000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function addLocalHours(isoLocal: string, hours: number): string {
  const base = localClockMinutes(isoLocal);
  const shifted = new Date((base + hours * 60) * 60000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function clockLabel(isoLocal: string): string {
  const hour = Number(isoLocal.slice(11, 13));
  const minute = Number(isoLocal.slice(14, 16));
  if (!Number.isFinite(hour)) return isoLocal;
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  if (!minute) return `${hour12}${suffix}`;
  return `${hour12}:${String(minute).padStart(2, "0")}${suffix}`;
}

export function weekdayLabel(date: string, today?: string): string {
  if (today && date === today) return "Today";
  if (today && date === addDays(today, 1)) return "Tomorrow";
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(utc);
}

export function monthDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatZonedTime(isoUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoUtc));
}

export function ymdCompact(timeZone: string, date: Date): string {
  return todayInZone(timeZone, date).replaceAll("-", "");
}
