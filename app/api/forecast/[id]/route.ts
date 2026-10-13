import { clearForecastCache, getForecast } from "@/lib/forecast";
import { getSpot } from "@/lib/spots";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!getSpot(id)) {
    return Response.json({ error: "Unknown break." }, { status: 404 });
  }
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  if (fresh) clearForecastCache(id);
  try {
    const forecast = await getForecast(id, { fresh });
    return Response.json(forecast, {
      headers: { "Cache-Control": fresh ? "no-store" : "public, max-age=60" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Forecast failed." },
      { status: 502 },
    );
  }
}
