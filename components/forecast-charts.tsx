"use client";

import type { ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Units } from "@/lib/format";
import { heightNumber, heightUnit, speedNumber, speedUnit } from "@/lib/format";
import { clockLabel } from "@/lib/time";
import type { DayForecast, DerivedHour, WindKind } from "@/lib/types";

const windColors: Record<WindKind, string> = {
  glassy: "#5c7c99",
  offshore: "#0f6e68",
  "cross-offshore": "#3d8f86",
  sideshore: "#c4841d",
  "cross-onshore": "#c46a45",
  onshore: "#a33b32",
};

type Row = {
  label: string;
  time: string;
  face: number;
  primary: number;
  secondary: number;
  windsea: number;
  wind: number;
  gust: number | null;
  tide: number | null;
  windType: WindKind;
  score: number;
  inWindow: boolean;
};

function rowsFor(hours: DerivedHour[], day: DayForecast, units: Units): Row[] {
  const windowStart = day.window ? clockMinutes(day.window.start) : null;
  const windowEnd = day.window ? clockMinutes(day.window.end) : null;
  return hours.map((hour) => {
    const minute = clockMinutes(hour.time);
    return {
      label: clockLabel(hour.time).replace(":00", ""),
      time: hour.time,
      face: units === "metric" ? hour.faceFt / 3.28084 : hour.faceFt,
      primary: heightNumber(hour.swellSource === "windsea" ? 0 : hour.swellHeightM, units),
      secondary: heightNumber(hour.otherSwellHeightM ?? 0, units),
      windsea: heightNumber(hour.windWaveHeightM ?? 0, units),
      wind: speedNumber(hour.windSpeedMs, units),
      gust: hour.windGustMs == null ? null : speedNumber(hour.windGustMs, units),
      tide: hour.tideM == null ? null : heightNumber(hour.tideM, units),
      windType: hour.windType,
      score: hour.score,
      inWindow:
        windowStart != null && windowEnd != null && minute >= windowStart && minute < windowEnd,
    };
  });
}

function clockMinutes(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
      <h3 className="font-display text-xl tracking-tight">{title}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{note}</p>
      <div className="h-56 w-full">{children}</div>
    </section>
  );
}

function Tip({
  active,
  payload,
  units,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  units: Units;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg bg-ink px-3 py-2 text-xs text-[#f6f0e4] shadow-lg">
      <p className="font-medium">{clockLabel(row.time)}</p>
      <p>
        Face {row.face.toFixed(1)} {heightUnit(units)} · score {row.score}
      </p>
      <p>
        Wind {Math.round(row.wind)} {speedUnit(units)} · {row.windType}
      </p>
      {row.tide != null ? (
        <p>
          Tide {row.tide.toFixed(units === "metric" ? 2 : 1)} {heightUnit(units)}
        </p>
      ) : null}
    </div>
  );
}

export function ForecastCharts({
  hours,
  day,
  units,
}: {
  hours: DerivedHour[];
  day: DayForecast;
  units: Units;
}) {
  const data = rowsFor(hours, day, units);
  const windowStart = day.window ? clockLabel(day.window.start).replace(":00", "") : null;
  const windowLast = day.window ? clockLabel(addHourBack(day.window.end)).replace(":00", "") : null;
  const tideValues = data.map((row) => row.tide).filter((value): value is number => value != null);
  const faceMax = Math.max(2, ...data.map((row) => row.face));
  const windMax = Math.max(units === "metric" ? 20 : 12, ...data.map((row) => row.gust ?? row.wind));

  return (
    <div className="grid min-w-0 gap-4">
      <ChartCard
        title="Surf height"
        note="Estimated face height for each hour. The shaded block is the best three-hour stretch."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e4d8c4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5c6a72", fontSize: 11 }} interval={2} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#5c6a72", fontSize: 11 }}
              width={36}
              axisLine={false}
              tickLine={false}
              domain={[0, Math.ceil(faceMax * 1.15)]}
              unit={units === "metric" ? "m" : "ft"}
            />
            <Tooltip content={<Tip units={units} />} />
            {windowStart && windowLast ? (
              <ReferenceArea x1={windowStart} x2={windowLast} fill="#0f6e68" fillOpacity={0.12} />
            ) : null}
            <Area type="monotone" dataKey="face" stroke="#0f6e68" fill="#0f6e68" fillOpacity={0.25} strokeWidth={2} name="Face" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Swell breakdown"
        note="Primary swell, the other swell, and local windsea. The rating uses whichever swell produces more face height on this beach."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e4d8c4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5c6a72", fontSize: 11 }} interval={2} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#5c6a72", fontSize: 11 }} width={36} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip units={units} />} />
            <Line type="monotone" dataKey="primary" stroke="#1d4e89" strokeWidth={2} dot={false} name="Primary" />
            <Line type="monotone" dataKey="secondary" stroke="#c4841d" strokeWidth={2} dot={false} name="Secondary" />
            <Line type="monotone" dataKey="windsea" stroke="#a33b32" strokeWidth={2} dot={false} name="Windsea" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#1d4e89]" /> Swell used as primary</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#c4841d]" /> Other swell</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#a33b32]" /> Windsea</li>
      </ul>

      <ChartCard
        title="Wind"
        note="Bar color is the wind relative to this beach: teal is offshore or light, amber is sideshore, rust is onshore. The line is gusts."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e4d8c4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5c6a72", fontSize: 11 }} interval={2} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#5c6a72", fontSize: 11 }}
              width={36}
              axisLine={false}
              tickLine={false}
              domain={[0, Math.ceil(windMax * 1.1)]}
            />
            <Tooltip content={<Tip units={units} />} />
            <Bar dataKey="wind" radius={[3, 3, 0, 0]}>
              {data.map((row) => (
                <Cell key={row.time} fill={windColors[row.windType]} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="gust" stroke="#17242c" strokeWidth={1.5} dot={false} name="Gust" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {tideValues.length > 0 ? (
        <ChartCard title="Tide" note="Hourly height relative to mean lower low water. Highs and lows are listed under the day.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e4d8c4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#5c6a72", fontSize: 11 }} interval={2} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#5c6a72", fontSize: 11 }}
                width={36}
                axisLine={false}
                tickLine={false}
                domain={[
                  Math.floor((Math.min(...tideValues) - 0.3) * 10) / 10,
                  Math.ceil((Math.max(...tideValues) + 0.3) * 10) / 10,
                ]}
              />
              <Tooltip content={<Tip units={units} />} />
              <Area type="monotone" dataKey="tide" stroke="#1d4e89" fill="#1d4e89" fillOpacity={0.2} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <section className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          Tide chart unavailable for this day.
        </section>
      )}
    </div>
  );
}

function addHourBack(iso: string): string {
  const hour = Number(iso.slice(11, 13));
  const previous = (hour + 23) % 24;
  return `${iso.slice(0, 11)}${String(previous).padStart(2, "0")}${iso.slice(13)}`;
}
