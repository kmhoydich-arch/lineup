"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/components/providers";

export function SiteHeader() {
  const { units, setUnits } = useUnits();

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="font-display text-[1.7rem] leading-none tracking-tight text-ink">
          Lineup
        </Link>
        <p className="hidden text-sm text-muted-foreground sm:block">Free surf reports</p>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="sm" className="min-h-10 px-2.5" nativeButton={false} render={<Link href="/how-it-works" />}>
            Scoring
          </Button>
          <div className="flex rounded-lg bg-secondary p-0.5" role="group" aria-label="Units">
            <Button
              type="button"
              size="sm"
              variant={units === "us" ? "default" : "ghost"}
              className="min-h-9 px-2.5"
              aria-pressed={units === "us"}
              onClick={() => setUnits("us")}
            >
              ft
            </Button>
            <Button
              type="button"
              size="sm"
              variant={units === "metric" ? "default" : "ghost"}
              className="min-h-9 px-2.5"
              aria-pressed={units === "metric"}
              onClick={() => setUnits("metric")}
            >
              m
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
