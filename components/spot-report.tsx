"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { refreshForecast } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConditionCompass } from "@/components/condition-compass";
import { ForecastCharts } from "@/components/forecast-charts";
import { HourlyTable } from "@/components/hourly-table";
import { RatingBadge } from "@/components/rating-badge";
import { useUnits } from "@/components/providers";
import {
  formatFacePrecise,
  formatFaceRange,
  formatSpeed,
  formatSwellHeight,
  formatTemp,
  formatTide,
} from "@/lib/format";
import { compassPoint } from "@/lib/geo";
import { buildSummary, buoyComparison, sizeWords, skyLabel, windLabel, windowBlurb } from "@/lib/summary";
import { clockLabel, formatZonedTime, monthDay, weekdayLabel } from "@/lib/time";
import type { Forecast, Spot } from "@/lib/types";

export function SpotReport({ spot, forecast }: { spot: Spot; forecast: Forecast }) {
  const { units } = useUnits();
  const router = useRouter();
  const [pending, start] = useTransition();
  const now = forecast.hours[forecast.nowIndex] ?? forecast.hours[0];
  const initialDay = now?.time.slice(0, 10) ?? forecast.days[0]?.date;
  const [selected, setSelected] = useState(initialDay);
  const day = forecast.days.find((item) => item.date === selected) ?? forecast.days[0];
  const dayHours = useMemo(
    () => forecast.hours.filter((hour) => hour.time.slice(0, 10) === day?.date),
    [day?.date, forecast.hours],
  );
  const windowHour = day?.window
    ? dayHours.find((hour) => hour.time === addHours(day.window!.start, 1)) ?? dayHours.find((hour) => hour.time === day.window!.start)
    : null;

  if (!now || !day) {
    return <p className="text-muted-foreground">The model returned an empty forecast.</p>;
  }

  const summary = buildSummary(spot, now, units);
  const sky = skyLabel(now.weatherCode);
  const comparison = buoyComparison(forecast.buoy?.waveHeightM ?? null, now.waveHeightM, units);
  const extremes = forecast.tideExtremes.filter((extreme) => extreme.time.slice(0, 10) === day.date);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-5">
      <div className="grid min-w-0 gap-4 lg:col-span-2">
        <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-sea uppercase">Right now</p>
              <p className="mt-2 font-display text-5xl leading-none tracking-tight sm:text-6xl">
                {formatFaceRange(now.faceFt, units)}
              </p>
              <p className="mt-2 text-muted-foreground">{sizeWords(now.faceFt)}</p>
            </div>
            <RatingBadge rating={now.rating} className="mt-6" />
          </div>
          <p className="mt-4 text-base leading-7">{summary}</p>
          {now.faceFt >= 12 ? (
            <p className="mt-3 rounded-xl bg-[#f6e4c2] px-3 py-2 text-sm text-[#8a5a10]">
              This is large. Only go if you know the break and the paddle.
            </p>
          ) : null}
          <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <Stat
              label="Swell"
              value={`${compassPoint(now.swellDir)} ${formatSwellHeight(now.swellHeightM, units)}`}
              detail={`${Math.round(now.swellPeriodS)}s`}
            />
            <Stat
              label="Wind"
              value={formatSpeed(now.windSpeedMs, units)}
              detail={windLabel(now.windType)}
            />
            <Stat
              label="Tide"
              value={now.tideM == null ? "—" : formatTide(now.tideM, units)}
              detail={now.tideStage ? `${now.tideStage}, ${now.tideTrend}` : "No station"}
            />
          </dl>
          <div className="mt-5">
            <ConditionCompass spot={spot} hour={now} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            About {formatFacePrecise(now.faceFt, units)} of face height.
            {sky ? ` ${sky}.` : ""}{" "}
            {now.tempC != null ? `Air ${formatTemp(now.tempC, units)}.` : ""}{" "}
            {forecast.waterTempC != null
              ? `Water ${formatTemp(forecast.waterTempC, units)}${forecast.waterTempSource === "buoy" ? " from the buoy" : " from the model"}.`
              : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Updated {formatZonedTime(forecast.fetchedAt, spot.timezone)} {spot.timezone.replaceAll("_", " ")}.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-10"
            disabled={pending}
            onClick={() => {
              start(async () => {
                await refreshForecast(spot.id);
                router.refresh();
              });
            }}
          >
            {pending ? "Refreshing…" : "Refresh forecast"}
          </Button>
        </section>

        <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl tracking-tight">Why this score</h2>
            <p className="tabular-nums text-sm text-muted-foreground">{now.score}/100</p>
          </div>
          <div className="mt-4 grid gap-3">
            <Meter label="Swell angle" value={now.points.direction} max={35} hint={`${Math.round(now.swellAngle)}° off straight in`} />
            <Meter label="Wind" value={now.points.wind} max={35} hint={`${windLabel(now.windType)}, ${formatSpeed(now.windSpeedMs, units)}`} />
            <Meter label="Period" value={now.points.period} max={20} hint={`${Math.round(now.swellPeriodS)} seconds`} />
            <Meter
              label="Tide"
              value={now.points.tide}
              max={10}
              hint={now.tideStage ? `${now.tideStage} on a ${spot.breakType} break` : "Neutral, no usable tide"}
            />
          </div>
          {now.rawScore !== now.score ? (
            <p className="mt-3 text-sm text-muted-foreground">Parts add up to {now.rawScore} before the caps below.</p>
          ) : null}
          {now.caps.length ? (
            <ul className="mt-3 grid gap-2 text-sm">
              {now.caps.map((cap) => (
                <li key={cap} className="rounded-xl bg-secondary px-3 py-2">
                  {cap}
                </li>
              ))}
            </ul>
          ) : null}
          <Link href="/how-it-works" className="mt-4 inline-block text-sm text-sea underline-offset-4 hover:underline">
            Read the full scoring rules
          </Link>
        </section>

        <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="font-display text-2xl tracking-tight">Live buoy</h2>
          {forecast.buoy ? (
            <div className="mt-3 space-y-2 text-sm leading-6">
              <p>
                {forecast.buoy.name} ({forecast.buoy.id}), observed{" "}
                {formatZonedTime(forecast.buoy.observedAt, spot.timezone)}, {Math.max(0, Math.round(forecast.buoy.ageMinutes))} min ago.
              </p>
              <p>
                {forecast.buoy.waveHeightM != null
                  ? `Wave height ${formatSwellHeight(forecast.buoy.waveHeightM, units)}`
                  : "No wave height in this report"}
                {forecast.buoy.periodS != null ? ` at ${Math.round(forecast.buoy.periodS)}s` : ""}
                {forecast.buoy.direction != null ? ` from the ${compassPoint(forecast.buoy.direction)}` : ""}.
              </p>
              {forecast.buoy.waterTempC != null ? <p>Water {formatTemp(forecast.buoy.waterTempC, units)}.</p> : null}
              {comparison ? <p className="text-muted-foreground">{comparison}</p> : null}
              {forecast.buoyNote ? <p className="text-muted-foreground">{forecast.buoyNote}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{forecast.buoyNote}</p>
          )}
        </section>
      </div>

      <div className="grid min-w-0 gap-4 lg:col-span-3">
        <section className="min-w-0">
          <h2 className="font-display text-2xl tracking-tight">Next {forecast.days.length} days</h2>
          <div className="mt-3 flex min-w-0 gap-3 overflow-x-auto pb-2">
            {forecast.days.map((item) => {
              const active = item.date === day.date;
              return (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => setSelected(item.date)}
                  aria-pressed={active}
                  className={`min-w-36 shrink-0 rounded-2xl p-3 text-left ring-1 transition-colors ${
                    active ? "bg-ink text-[#f6f0e4] ring-ink" : "bg-card ring-foreground/10"
                  }`}
                >
                  <p className="text-xs tracking-wide uppercase opacity-70">
                    {weekdayLabel(item.date, forecast.today)} · {monthDay(item.date)}
                  </p>
                  <p className="mt-2 font-display text-2xl leading-none">
                    {formatFaceRange(item.window?.faceFt ?? item.maxFaceFt, units)}
                  </p>
                  <p className="mt-2 text-sm capitalize">{item.window?.rating ?? "—"}</p>
                  <p className="text-xs opacity-80">
                    {item.window ? `${clockLabel(item.window.start)}–${clockLabel(item.window.end)}` : "No window"}
                  </p>
                </button>
              );
            })}
          </div>
          {day.window && windowHour ? (
            <p className="mt-2 text-sm text-muted-foreground">{windowBlurb(windowHour)}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No three-hour stretch stands out.</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {day.sunrise ? `Sunrise ${clockLabel(day.sunrise)}` : "Sunrise unavailable"}
            {" · "}
            {day.sunset ? `sunset ${clockLabel(day.sunset)}` : "sunset unavailable"}
            {extremes.length ? (
              <>
                {" · "}
                {extremes.slice(0, 4).map((extreme) => `${extreme.kind} ${clockLabel(extreme.time)} ${formatTide(extreme.heightM, units)}`).join(" · ")}
              </>
            ) : null}
          </p>
          {forecast.tideNote ? <p className="mt-2 text-xs text-muted-foreground">{forecast.tideNote}</p> : null}
        </section>

        <ForecastCharts hours={dayHours} day={day} units={units} />
        <HourlyTable
          hours={dayHours}
          units={units}
          windowStart={day.window?.start ?? null}
          windowEnd={day.window?.end ?? null}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-secondary/70 px-2 py-2">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
      <dd className="text-xs text-muted-foreground capitalize">{detail}</dd>
    </div>
  );
}

function Meter({ label, value, max, hint }: { label: string; value: number; max: number; hint: string }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-secondary">
        <div className="h-full rounded-full bg-sea" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function addHours(iso: string, hours: number): string {
  const hour = Number(iso.slice(11, 13));
  const next = hour + hours;
  const dayShift = Math.floor(next / 24);
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + dayShift, next % 24, Number(iso.slice(14, 16))));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  const h = String(utc.getUTCHours()).padStart(2, "0");
  const min = String(utc.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}
