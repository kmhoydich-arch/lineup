import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { evaluateConditions } from "@/lib/rating";
import {
  DIRECTION_POINTS,
  EXPOSURE_FACTORS,
  PERIOD_FACTORS,
  PERIOD_POINTS,
  RATING_THRESHOLDS,
  TIDE_NEUTRAL_POINTS,
  WIND_POINTS,
  WIND_SECTORS,
  WINDSEA_FACE_DISCOUNT,
} from "@/lib/rating";

export const metadata: Metadata = {
  title: "How the rating works",
  description:
    "The face-height formula, the 100-point score, and the free data sources behind Lineup.",
};

const example = evaluateConditions({
  beachFacing: 270,
  breakType: "beach",
  swellHeightM: 1.4,
  swellPeriodS: 13,
  swellDir: 275,
  windSpeedMs: 3.5,
  windDir: 80,
  tidePosition: 0.48,
});

export default function HowItWorksPage() {
  return (
    <article id="content" className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <p className="text-xs font-medium tracking-[0.16em] text-sea uppercase">Scoring</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">How a rating gets made</h1>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">
        Lineup turns public model data into a size and a score you can check. The same rules run for every break. Nothing here is a local surf guide, and nothing here is a decision to paddle out.
      </p>

      <Section title="What the beach facing means">
        <p>
          Each break has a compass direction, in degrees, for the way the beach looks out at open water. West is 270. A swell direction is where the swell comes from, so a swell from 270 hits a west-facing beach straight on. Wind direction is also where the wind comes from. Offshore wind on that same beach comes from the east, 90 degrees, because it blows from the land toward the sea.
        </p>
        <p>
          These facings are estimates of the open-ocean direction, not a survey of every peak. A point break can love an angled swell that this score marks down. Read the breakdown, then trust what you see.
        </p>
      </Section>

      <Section title="Face height">
        <p>
          Surf height is an estimate of the wave face, in feet, from the swell that actually arrives at the beach. It is not the significant wave height from a buoy, and it is not a measured surf report.
        </p>
        <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-sm leading-6 text-[#f6f0e4]">
          face ft = swell meters × 3.28084 × period factor × exposure
        </pre>
        <p>Period factor, from the swell period in seconds:</p>
        <Table
          headers={["Period", "Factor"]}
          rows={PERIOD_FACTORS.map((row) => [
            row.maxExclusive === Number.POSITIVE_INFINITY ? "18s and up" : `under ${row.maxExclusive}s`,
            String(row.factor),
          ])}
        />
        <p>Exposure is how square the swell is to the beach. Angle is the smallest difference between swell direction and beach facing.</p>
        <Table
          headers={["Angle off straight in", "Exposure"]}
          rows={EXPOSURE_FACTORS.map((row) => [`up to ${row.maxAngle}°`, String(row.factor)])}
        />
        <p>
          If two swells are in the water, the score uses the one that makes the bigger face on this beach, not automatically the taller one offshore. Local windsea is only used when both swells are under about 0.25 m, and then its face height is multiplied by {WINDSEA_FACE_DISCOUNT} because it is poorly organized. The page says when that happens.
        </p>
        <p>
          The range on the card, like 4–6 ft, is that face estimate rounded into the kind of spread a surf report uses. The precise estimate sits underneath it.
        </p>
      </Section>

      <Section title="The 100-point score">
        <p>Four parts, then a few caps so one good ingredient cannot hide a bad one.</p>
        <h3 className="font-display text-2xl tracking-tight">Swell angle, 35 points</h3>
        <Table
          headers={["Angle", "Points"]}
          rows={DIRECTION_POINTS.map((row) => [`up to ${row.maxAngle}°`, String(row.points)])}
        />
        <h3 className="mt-6 font-display text-2xl tracking-tight">Wind, 35 points</h3>
        <p>
          The offshore direction is the beach facing plus 180 degrees. The angle between the wind and that offshore direction picks a sector. Under 4 mph from any direction is glassy.
        </p>
        <Table
          headers={["Sector", "Angle from offshore"]}
          rows={WIND_SECTORS.map((row) => [row.kind, `up to ${row.maxAngle}°`])}
        />
        <Table
          headers={["Wind", "Up to", "Points"]}
          rows={WIND_POINTS.map((row) => [
            row.kind,
            row.maxMph >= 1000 ? "above the previous band" : `${row.maxMph} mph`,
            String(row.points),
          ])}
        />
        <h3 className="mt-6 font-display text-2xl tracking-tight">Period, 20 points</h3>
        <Table
          headers={["Period", "Points"]}
          rows={PERIOD_POINTS.map((row) => [`${row.min}s and up`, String(row.points)])}
        />
        <h3 className="mt-6 font-display text-2xl tracking-tight">Tide, 10 points</h3>
        <p>
          This is a general habit for the break type, not a secret spot. Beach breaks score best from 35–65% of the daily range. Points prefer 40–75%. Reefs prefer 45–80% and lose more points on a very low tide. If the daily range is under 0.15 m, or there is no station, tide gets a neutral {TIDE_NEUTRAL_POINTS}.
        </p>
        <p>NOAA heights are relative to mean lower low water. International breaks have no NOAA tide, so they stay at that neutral number and the page says so.</p>
      </Section>

      <Section title="Caps, then the word">
        <ul className="list-disc space-y-2 pl-5">
          <li>More than 110° off the beach: score capped at 41.</li>
          <li>More than 80° off the beach: score capped at 55.</li>
          <li>Period under 7 seconds: score capped at 61, so it cannot read Good or Epic.</li>
          <li>Face under 3 ft and period under 10 seconds: score capped at 61. Clean knee-high windswell stays Fair.</li>
          <li>Onshore or cross-onshore faster than 18 mph: score capped at 41.</li>
          <li>Face height under 1 ft: the word is Poor even if the wind is perfect. The points still show.</li>
        </ul>
        <Table
          headers={["Score", "Word"]}
          rows={[
            [`${RATING_THRESHOLDS.epic}–100`, "Epic"],
            [`${RATING_THRESHOLDS.good}–${RATING_THRESHOLDS.epic - 1}`, "Good"],
            [`${RATING_THRESHOLDS.fair}–${RATING_THRESHOLDS.good - 1}`, "Fair"],
            [`0–${RATING_THRESHOLDS.fair - 1}`, "Poor"],
          ]}
        />
      </Section>

      <Section title="A worked example">
        <p>
          West-facing beach. Swell 1.4 m from 275° at 13 seconds. Wind 3.5 m/s from 80°. Tide sitting at 48% of the daily range.
        </p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          <li>Face height: {example.faceFt.toFixed(1)} ft</li>
          <li>Angle: {Math.round(example.angle)}°</li>
          <li>Wind: {example.windType}, {example.windMph.toFixed(0)} mph</li>
          <li>Direction points: {example.points.direction}/35</li>
          <li>Wind points: {example.points.wind}/35</li>
          <li>Period points: {example.points.period}/20</li>
          <li>Tide points: {example.points.tide}/10</li>
          <li>Score: {example.score} · {example.rating}</li>
        </ul>
        <p>Change any input and the same function runs on every hour of every break.</p>
      </Section>

      <Section title="Best time of day">
        <p>
          For each local day, daylight hours are walked in three-hour blocks. The block with the highest average score is the highlighted window. If nothing is actually good, the page still shows the least-bad block and says so. Sunrise and sunset come from the Open-Meteo weather response.
        </p>
      </Section>

      <Section title="Data sources">
        <p>No API keys. Each source was called successfully while this app was built, on October 13, 2026.</p>
        <ul className="space-y-3">
          <li>
            <a className="font-medium text-sea underline-offset-4 hover:underline" href="https://open-meteo.com/en/docs/marine-weather-api">
              Open-Meteo Marine API
            </a>
            . Hourly wave height, primary and secondary swell height, period, and direction, wind-wave height, and sea-surface temperature. The request is offset a few kilometers offshore along the beach facing so the grid point is over water. A sample at the San Francisco Bar returned a full 8-day hourly series.
          </li>
          <li>
            <a className="font-medium text-sea underline-offset-4 hover:underline" href="https://open-meteo.com/en/docs">
              Open-Meteo Forecast API
            </a>
            . Hourly wind speed, direction, and gusts, air temperature, weather code, and daily sunrise and sunset. Wind is requested in meters per second.
          </li>
          <li>
            <a className="font-medium text-sea underline-offset-4 hover:underline" href="https://www.ndbc.noaa.gov/">
              NOAA NDBC realtime buoy files
            </a>
            . <code>https://www.ndbc.noaa.gov/data/realtime2/&lt;station&gt;.txt</code>. On that check, station 46237 (San Francisco Bar) reported about 1.5 m at 15 seconds, and 51201 (Waimea Bay) was reporting as well. Observations older than 6 hours are not shown as live. There is no NDBC coverage for the international breaks.
          </li>
          <li>
            <a className="font-medium text-sea underline-offset-4 hover:underline" href="https://api.tidesandcurrents.noaa.gov/api/prod/">
              NOAA CO-OPS Data API
            </a>
            . Hourly tide predictions, datum MLLW, metric, local time. Station 9414290 (San Francisco) returned a full prediction series. Some nearby harbors are subordinate stations. For those, Lineup shifts the reference station by the average of the NOAA high and low time offsets and scales height by the average ratio. The station name on the page says when that happens.
          </li>
        </ul>
      </Section>

      <Section title="What this will get wrong">
        <ul className="list-disc space-y-2 pl-5">
          <li>Nearshore bathymetry, sandbars, and shadowing from points and islands are not in the model. A west swell that looks square on the compass can still be blocked.</li>
          <li>The marine grid is coarse. The offshore nudge helps, and it is still a model cell, not the lineup.</li>
          <li>Buoys measure offshore waves. They are shown beside the forecast, not swapped in as the surf height.</li>
          <li>Tide preference is a break-type habit. Your spot may want the opposite.</li>
          <li>A high score on a huge day is not an invitation. The page adds a size warning and leaves the decision with you.</li>
        </ul>
        <p>
          <Link href="/" className="text-sea underline-offset-4 hover:underline">
            Back to the breaks
          </Link>
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-3 text-base leading-7">
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-foreground/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/80 text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")} className="odd:bg-card even:bg-[#f3ecdf]">
              {row.map((cell) => (
                <td key={cell} className="px-3 py-2 capitalize">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
