"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingBadge } from "@/components/rating-badge";
import { useFavorites, useUnits } from "@/components/providers";
import { formatFaceRange } from "@/lib/format";
import { compassPoint } from "@/lib/geo";
import { sizeWords, windLabel } from "@/lib/summary";
import type { NowSnapshot, Spot } from "@/lib/types";

export function SpotCard({
  spot,
  now,
  status,
}: {
  spot: Spot;
  now?: NowSnapshot;
  status: "loading" | "ready" | "error";
}) {
  const { units } = useUnits();
  const favorites = useFavorites();
  const starred = favorites.has(spot.id);

  return (
    <article className="relative rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(23,36,44,0.45)]">
      <Link href={`/spot/${spot.id}`} className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea" aria-label={`${spot.name} surf report`} />
      <div className="relative flex items-start justify-between gap-3 pointer-events-none">
        <div>
          <h2 className="font-display text-2xl leading-none tracking-tight">{spot.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {spot.place} · {spot.breakType}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto relative z-10 size-11"
          aria-pressed={starred}
          aria-label={starred ? `Remove ${spot.name} from favorites` : `Save ${spot.name} on this device`}
          onClick={() => favorites.toggle(spot.id)}
        >
          <Star className={starred ? "fill-sun text-sun" : ""} />
        </Button>
      </div>
      <div className="relative mt-4 pointer-events-none">
        {status === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-muted-foreground">Conditions did not load. Open the break to try again.</p>
        ) : null}
        {status === "ready" && now ? (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-3xl leading-none tracking-tight">{formatFaceRange(now.faceFt, units)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {sizeWords(now.faceFt)} · {compassPoint(now.swellDir)} {Math.round(now.swellPeriodS)}s
              </p>
              <p className="text-sm text-muted-foreground">{windLabel(now.windType)}</p>
            </div>
            <RatingBadge rating={now.rating} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
