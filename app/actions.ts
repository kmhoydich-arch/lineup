"use server";

import { clearForecastCache } from "@/lib/forecast";

export async function refreshForecast(spotId: string) {
  clearForecastCache(spotId);
}
