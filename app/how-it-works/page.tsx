import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { channelArrival, CHANNEL_WRAP_PEAK } from "@/lib/channel";
import { haversineKm } from "@/lib/geo";
import { MOP_TRANSECTS } from "@/lib/mop";
import { evaluateConditions } from "@/lib/rating";
import { SPOTS } from "@/lib/spots";
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

const campusChannel = { lon: -119.8438, window: { westWrap: 0.72, south: 0.7 } };
const campusWrap = evaluateConditions({
  beachFacing: 200,
  breakType: "point",
  swellHeightM: 2,
  swellPeriodS: 16,
  swellDir: 290,
  windSpeedMs: 3,
  windDir: 10,
  tidePosition: 0.55,
  channel: campusChannel,
});
const campusSouth = evaluateConditions({
  beachFacing: 200,
  breakType: "point",
  swellHeightM: 1.1,
  swellPeriodS: 14,
  swellDir: 180,
  windSpeedMs: 3,
  windDir: 10,
  tidePosition: 0.55,
  channel: campusChannel,
});
const campusShort = evaluateConditions({
  beachFacing: 200,
  breakType: "point",
  swellHeightM: 2,
  swellPeriodS: 9,
  swellDir: 280,
  windSpeedMs: 3,
  windDir: 10,
  tidePosition: 0.55,
  channel: campusChannel,
});
const wrapArrival = channelArrival(campusChannel.lon, 200, 290, 16, campusChannel.window);
const mopRows = SPOTS.filter((spot) => spot.channel && MOP_TRANSECTS[spot.id]).map((spot) => {
  const transect = MOP_TRANSECTS[spot.id];
  const km = haversineKm(spot.lat, spot.lon, transect.lat, transect.lon);
  return [spot.name, transect.id, `${km.toFixed(2)} km`];
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
          <li>Face under 2 ft: score capped at 61. Ankle-high surf stays Fair even when the wind is clean and the period is long.</li>
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

      <Section title="Nearshore model for the channel">
        <p>
          For the Santa Barbara Channel breaks, surf height starts from the CDIP MOP v1.1 alongshore nowcast and forecast, served as NetCDF on the CDIP THREDDS server. Each break uses the prediction site nearest its coordinates. A sample is used only when waveFlagPrimary is 1. Nowcast hours win when they are within 90 minutes. The forecast is every three hours, so the hours between two good forecast points are interpolated. Significant height, peak period, and peak direction are shown as CDIP published them.
        </p>
        <p>
          Face height is still Lineup&apos;s conversion: meters times 3.28084, times the period factor, times exposure to the beach facing. The channel-shadow multiplier is not applied on top of a nearshore height. If the flag is anything other than 1, or the file is missing, that hour falls back to the shadow estimate and the page says so.
        </p>
        <Table headers={["Break", "MOP transect", "Distance"]} rows={mopRows} />
        <p>
          Checked on October 15, 2026. Campus Point resolved to transect B0382, and the forecast and nowcast files returned waveFlagPrimary 1. CDIP&apos;s data-use terms allow public use of the products when they are not altered, and a web display has to link to the CDIP homepage. Lineup does that, and it does not relabel the face height as a CDIP measurement.{" "}
          <a className="text-sea underline-offset-4 hover:underline" href="https://cdip.ucsd.edu/">
            Data from CDIP, Scripps Institution of Oceanography
          </a>
          . DOI{" "}
          <a className="text-sea underline-offset-4 hover:underline" href="https://doi.org/10.18437/C7WC72">
            10.18437/C7WC72
          </a>
          .
        </p>
      </Section>

      <Section title="The Santa Barbara Channel">
        <p>
          The shadow math below is the fallback, used when MOP is flagged or missing, and it is the explanation of why a west swell offshore is not the wave on the beach. From Point Conception to Ventura the coast faces south, and the Channel Islands sit upwind of a west or northwest swell. A straight west swell does not hit Isla Vista the way it hits a west-facing beach in San Francisco. Two kinds of swell do the work here.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>South swell, roughly 145° to 205°, runs up the channel between the islands and the mainland. Spots that face south, especially Hammond&apos;s, Sands, Depressions, and Leadbetter, keep most of that height.</li>
          <li>West to northwest swell, roughly 255° to 325°, has to wrap around Point Conception. Longer period refracts into the channel. Short period mostly dies on the islands. The classic winter angle is about {CHANNEL_WRAP_PEAK}°.</li>
          <li>Anything north of that, or from the east, is blocked by the mainland itself. Almost none of it is counted.</li>
        </ul>
        <p>
          Each channel break has two numbers from 0 to 1. West wrap is how well that spot focuses a Conception wrap. Rincon and El Capitan are high. Goleta Beach is low. South is how open the spot is to swell coming up the channel. Depth is not a separate setting: it comes from longitude, so Refugio, close to Conception, keeps more wrapped west energy than Ventura.
        </p>
        <p>For a wrap, the height multiplier is:</p>
        <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-sm leading-6 text-[#f6f0e4]">
          {`transmission = west wrap × period × angle quality × (0.90 − 0.45 × depth)`}
        </pre>
        <p>
          Period runs from 0.32 at 8 seconds to 1 at 16 seconds and up. Angle quality is 1 at {CHANNEL_WRAP_PEAK}° and falls off over the next 45°. Depth is 0 at Point Conception and 1 at Ventura. The local arrival is then bent toward the beach facing, more so when the period is long, and the ordinary exposure table uses that bent direction. The page still names the offshore direction, and it says what percent of the offshore height was counted.
        </p>
        <p>
          Campus Point, facing 200°, west wrap 0.72, south 0.70. Same north wind and a mid tide in all three rows. The numbers come from the same function the forecast uses.
        </p>
        <Table
          headers={["Offshore swell", "Counted", "Face", "Word"]}
          rows={[
            [
              "2.0 m from 290° at 16s",
              `${Math.round((campusWrap.channelTransmission ?? 0) * 100)}%`,
              `${campusWrap.faceFt.toFixed(1)} ft`,
              campusWrap.rating,
            ],
            [
              "1.1 m from 180° at 14s",
              `${Math.round((campusSouth.channelTransmission ?? 0) * 100)}%`,
              `${campusSouth.faceFt.toFixed(1)} ft`,
              campusSouth.rating,
            ],
            [
              "2.0 m from 280° at 9s",
              `${Math.round((campusShort.channelTransmission ?? 0) * 100)}%`,
              `${campusShort.faceFt.toFixed(1)} ft`,
              campusShort.rating,
            ],
          ]}
        />
        <p>
          The 16 second wrap is bent to about {Math.round(wrapArrival.localDir)}° before the angle score. The 9 second swell is almost the same height offshore and much smaller on the beach, because it does not have the period to make the bend. If that leftover is still under about 22% of the offshore height, the score is capped at Fair.
        </p>
        <p>
          This is a coast-wide model, not a survey of every reef. It will miss a section that loves a slightly different angle. It does not apply outside this channel.
        </p>
      </Section>

      <Section title="Best time of day">
        <p>
          For each local day, daylight hours are walked in three-hour blocks. The block with the highest average score is the highlighted window. If nothing is actually good, the page still shows the least-bad block and says so. Sunrise and sunset come from the Open-Meteo weather response.
        </p>
      </Section>

      <Section title="Data sources">
        <p>
          No API keys. Open-Meteo, NDBC, and the tide stations were called successfully on October 13, 2026. CDIP MOP, the NWS grid, KSBA, and the live buoy search were called again on October 15, 2026.
        </p>
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
            . <code>https://www.ndbc.noaa.gov/data/realtime2/&lt;station&gt;.txt</code>. On October 13, station 46237 (San Francisco Bar) reported about 1.5 m at 15 seconds, and 51201 (Waimea Bay) was reporting as well. Channel breaks do not keep a backup buoy. Each request loads the NDBC active-station list, which includes CDIP buoys NDBC relays, and uses the nearest station that has a wave height in the last 6 hours. On October 15, East Santa Barbara 46053 was the closest buoy to Campus Point and its newest wave height was still October 6, so the page moved on to the next station that was actually reporting. The buoy card names the station and the distance. Observations older than 6 hours are not shown as live. There is no NDBC coverage for the international breaks.
          </li>
          <li>
            <a className="font-medium text-sea underline-offset-4 hover:underline" href="https://api.tidesandcurrents.noaa.gov/api/prod/">
              NOAA CO-OPS Data API
            </a>
            . Hourly tide predictions, datum MLLW, metric, local time. Station 9414290 (San Francisco) returned a full prediction series. Santa Barbara 9411340 and Ventura 9411270 both returned hourly predictions on October 13, 2026, and those are the gauges for the channel breaks. Some nearby harbors are subordinate stations. For those, Lineup shifts the reference station by the average of the NOAA high and low time offsets and scales height by the average ratio. The station name on the page says when that happens.
          </li>
          <li>
            <a className="font-medium text-sea underline-offset-4 hover:underline" href="https://cdip.ucsd.edu/">
              CDIP MOP
            </a>
            , Scripps Institution of Oceanography. Alongshore nowcast and forecast NetCDF on THREDDS, for the channel breaks only. waveFlagPrimary must be 1. The files for the transects in the table above answered on October 15, 2026.
          </li>
          <li>
            <a className="font-medium text-sea underline-offset-4 hover:underline" href="https://api.weather.gov/">
              api.weather.gov
            </a>
            . For Sands, Campus Point, Depressions, Coal Oil Point, Goleta Beach, and Haskell&apos;s, the current hour uses the latest KSBA observation and the other hours use the NWS Los Angeles (LOX) gridded forecast at that break&apos;s grid cell. Requests send a User-Agent. On October 15, 2026, KSBA returned a wind observation and Campus Point resolved to grid LOX 100,71. If either source fails, that hour stays on Open-Meteo. El Capitan through C Street stay on Open-Meteo wind.
          </li>
        </ul>
        <p>
          The session log is not a data source. Time, spot, body-relative height, how the wind felt, and whether it was worth it are stored in this browser and can be exported as CSV, with the model numbers for that hour filled in when the forecast on the page covers it.
        </p>
      </Section>

      <Section title="What this will get wrong">
        <ul className="list-disc space-y-2 pl-5">
          <li>CDIP MOP is a nearshore significant height at about 10 meters depth, not a measured surf report. Lineup still turns that height into a face estimate with period and exposure.</li>
          <li>The Channel Islands shadow is the fallback, and it is modeled only from Point Conception to Ventura. Other islands, points, and sandbars are not. A west swell that looks square on the compass can still be blocked somewhere else.</li>
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
