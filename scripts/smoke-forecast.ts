import { getForecast } from "../lib/forecast";
import { buildSummary } from "../lib/summary";
import { SPOTS, getSpot } from "../lib/spots";

const ids = ["ocean-beach-sf", "pipeline", "hossegor", "cocoa-beach", "lower-trestles", "jeffreys-bay"];

async function main() {
  console.log(`seeded spots: ${SPOTS.length}`);
  for (const id of ids) {
    const spot = getSpot(id);
    if (!spot) throw new Error(`missing ${id}`);
    const forecast = await getForecast(id);
    const now = forecast.hours[forecast.nowIndex];
    if (!now) throw new Error(`${id} has no current hour`);
    if (forecast.days.length < 7) throw new Error(`${id} only has ${forecast.days.length} days`);
    console.log(
      JSON.stringify({
        id,
        hours: forecast.hours.length,
        days: forecast.days.length,
        rating: now.rating,
        faceFt: Number(now.faceFt.toFixed(1)),
        score: now.score,
        wind: now.windType,
        tide: now.tideStage,
        buoyM: forecast.buoy?.waveHeightM ?? null,
        buoyNote: forecast.buoyNote,
        tideNote: forecast.tideNote,
        summary: buildSummary(spot, now, "us"),
      }),
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
