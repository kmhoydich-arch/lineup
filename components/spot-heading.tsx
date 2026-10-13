"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/components/providers";
import { compassWord } from "@/lib/geo";
import { breakLabel } from "@/lib/summary";
import type { Spot } from "@/lib/types";

export function SpotHeading({ spot }: { spot: Spot }) {
  const favorites = useFavorites();
  const starred = favorites.has(spot.id);

  return (
    <div className="mb-6">
      <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        All breaks
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-sea uppercase">
            {spot.coast} · {spot.country}
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{spot.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {spot.place} · {breakLabel(spot.breakType)} · faces {compassWord(spot.facing)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-pressed={starred}
          aria-label={starred ? `Remove ${spot.name} from favorites` : `Save ${spot.name} on this device`}
          onClick={() => favorites.toggle(spot.id)}
        >
          <Star className={starred ? "fill-sun text-sun" : ""} />
        </Button>
      </div>
      <p className="mt-4 max-w-2xl text-base leading-7">{spot.blurb}</p>
    </div>
  );
}
