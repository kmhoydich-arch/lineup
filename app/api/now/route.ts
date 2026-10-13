import { getForecast, toSnapshot } from "@/lib/forecast";
import { getSpot } from "@/lib/spots";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 6);

  const results = await Promise.all(
    ids.map(async (id) => {
      if (!getSpot(id)) return { id, ok: false as const, error: "Unknown break." };
      try {
        const forecast = await getForecast(id);
        return { id, ok: true as const, now: toSnapshot(forecast) };
      } catch (error) {
        return {
          id,
          ok: false as const,
          error: error instanceof Error ? error.message : "Forecast failed.",
        };
      }
    }),
  );

  return Response.json(
    { results },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
