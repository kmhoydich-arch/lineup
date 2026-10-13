import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForecastErrorView } from "@/components/forecast-error";
import { ReportSkeleton } from "@/components/report-skeleton";
import { SpotHeading } from "@/components/spot-heading";
import { SpotReport } from "@/components/spot-report";
import { ForecastError, getForecast } from "@/lib/forecast";
import { SPOTS, getSpot } from "@/lib/spots";

export function generateStaticParams() {
  return SPOTS.map((spot) => ({ id: spot.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const spot = getSpot(id);
  if (!spot) return { title: "Break not found" };
  return {
    title: `${spot.name} surf report`,
    description: `Free surf forecast for ${spot.name} in ${spot.place}. Size, wind, tide, and a plain-language rating.`,
  };
}

export default async function SpotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spot = getSpot(id);
  if (!spot) notFound();

  return (
    <div id="content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <SpotHeading spot={spot} />
      <Suspense fallback={<ReportSkeleton />}>
        <SpotForecast id={spot.id} />
      </Suspense>
    </div>
  );
}

async function SpotForecast({ id }: { id: string }) {
  const spot = getSpot(id);
  if (!spot) notFound();

  let forecast: Awaited<ReturnType<typeof getForecast>> | null = null;
  let message: string | null = null;
  try {
    forecast = await getForecast(id);
  } catch (error) {
    message =
      error instanceof ForecastError
        ? error.message
        : error instanceof Error
          ? error.message
          : "The forecast did not load.";
  }

  if (!forecast || message) {
    return <ForecastErrorView spotId={id} message={message ?? "The forecast did not load."} />;
  }
  return <SpotReport spot={spot} forecast={forecast} />;
}
