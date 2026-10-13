# Lineup

A free surf forecast and report. No account, no paywall, no ads.

Lineup covers breaks in the Santa Barbara Channel around Isla Vista, plus California, Hawaii, the US East Coast, and a few coasts abroad. The home page opens on the channel. Each break has a plain-language read of the conditions right now, a 100-point score with the math showing, and more than a week of hourly swell, wind, and tide.

## Run it

```bash
npm install
npm run dev
```

The dev server listens on [http://127.0.0.1:4317](http://127.0.0.1:4317). No API keys are required.

```bash
npm test        # rating rules
npm run lint
npm run build
npm start       # production, same port
```

To check live data for a handful of breaks:

```bash
npx tsx scripts/smoke-forecast.ts
```

Favorites and the ft/m switch are stored in the browser. Nothing is sent to an account, because there isn't one.

## What a report shows

- **Right now.** A surf-report size range, the estimated face height, and a short paragraph: swell, wind relative to the beach, and tide.
- **Score.** Poor, Fair, Good, or Epic, plus the four parts (swell angle, wind, period, tide) and any cap that lowered the total.
- **Compass.** The ocean is drawn at the top, the way it looks when you face the water, with swell and wind arrows.
- **Next 8 days.** Each day has a size, a rating, and the best three-hour stretch in daylight.
- **Charts and a table.** Face height, swell breakdown, wind (colored by offshore or onshore), and tide, plus every hour in a table.
- **Buoy.** A fresh NOAA observation when one is near the break, compared with the model and labeled as offshore wave height, not face height.

The rules are written out at `/how-it-works`, and the page computes a worked example with the same function the forecast uses.

## Rating, in short

Face height, in feet:

```text
swell meters × 3.28084 × period factor × exposure
```

Period factor runs from 0.55 under 6 seconds to 1.6 at 18 seconds and up. Exposure runs from 1.0 when the swell is within 25° of the beach facing, down to 0.15 when it is coming from the wrong side of the coast. If two swells are in the water, the one that makes the bigger face on this beach is the one that gets scored. Windsea is used only when the groundswell is negligible, and then at a 0.75 discount.

The score is 100 points:

| Part | Points | Idea |
| --- | --- | --- |
| Swell angle | 35 | How square the chosen swell is to the beach facing |
| Wind | 35 | Offshore and light score high. Onshore and strong score nothing. Under 4 mph is glassy. |
| Period | 20 | Longer period scores higher |
| Tide | 10 | A general preference for the break type (beach, point, or reef), neutral when there is no station |

Caps keep one good ingredient from hiding a bad one: swell aimed away from the beach, period under 7 seconds, strong onshore wind, small short-period surf, and anything under 2 ft. Under 1 ft of face is always Poor.

Epic is 82+, Good is 64+, Fair is 44+, and anything lower is Poor. Full tables are in the app.

Beach facing is the compass direction the beach looks toward open water. These are estimates, not a survey of every peak.

Breaks from Refugio to C Street also multiply that face by a channel transmission. West and northwest swell is shadowed by the Channel Islands and has to wrap around Point Conception, so a longer period counts for more, and spots farther east keep less of it. South swell runs up the channel and is not shadowed the same way. The home view defaults to that coast. The full formula is on `/how-it-works`.

## Data sources

All of these are free and keyless. They were called successfully on October 13, 2026.

| Source | Used for | Notes |
| --- | --- | --- |
| [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) | Swell height, period, direction, secondary swell, wind waves, sea temperature | 8-day hourly. The request is nudged offshore along the beach facing so the grid cell is over water. |
| [Open-Meteo Forecast](https://open-meteo.com/en/docs) | Wind, gusts, air temperature, weather, sunrise, sunset | Wind is requested in m/s. |
| [NOAA NDBC](https://www.ndbc.noaa.gov/) realtime2 files | Live buoy wave height, period, direction, water temperature | `https://www.ndbc.noaa.gov/data/realtime2/<id>.txt`. Readings older than 6 hours are not shown as live. Channel breaks use West Santa Barbara 46054. East Santa Barbara 46053 is closer to Isla Vista, but its wave height has been missing since October 6, 2026. |
| [NOAA CO-OPS](https://api.tidesandcurrents.noaa.gov/api/prod/) | Hourly tide predictions, datum MLLW | Subordinate stations are shifted from their reference station using NOAA high/low offsets. |

International breaks have swell and wind only. NOAA buoys and tides do not cover them, and the page says so instead of inventing a tide.

A server process keeps a forecast for about 20 minutes, then fetches again. The "right now" hour is chosen on each read, so it stays on the current hour inside that window.

## Install as an app

`app/manifest.ts` and `public/sw.js` make Lineup installable. The service worker registers in production (`npm start` or a host), not during `npm run dev`, so development stays easy to refresh.

## Limits

The marine grid does not know the sandbar. The Channel Islands shadow is modeled from Point Conception to Ventura, and it is still a coast-wide estimate, not every reef. A buoy outside the channel reads larger than the beach. Tide preference is a break-type habit. A high score on a huge day is not a recommendation to paddle out.
