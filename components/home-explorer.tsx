"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpotCard } from "@/components/spot-card";
import { useFavorites } from "@/components/providers";
import { COASTS, SPOTS } from "@/lib/spots";
import type { Coast, NowSnapshot } from "@/lib/types";

type CardStatus = "loading" | "ready" | "error";

type CardState = {
  status: CardStatus;
  now?: NowSnapshot;
  error?: string;
};

export function HomeExplorer() {
  const favorites = useFavorites();
  const [query, setQuery] = useState("");
  const [coast, setCoast] = useState<Coast | "All">("Santa Barbara / Isla Vista");
  const [cards, setCards] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(SPOTS.map((spot) => [spot.id, { status: "loading" as const }])),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const ids = SPOTS.map((spot) => spot.id);
    let cancelled = false;

    async function load() {
      for (let index = 0; index < ids.length; index += 4) {
        if (cancelled) return;
        const chunk = ids.slice(index, index + 4);
        try {
          const response = await fetch(`/api/now?ids=${chunk.join(",")}`, { signal: controller.signal });
          if (!response.ok) throw new Error("The conditions request failed.");
          const body = (await response.json()) as {
            results: { id: string; ok: boolean; now?: NowSnapshot; error?: string }[];
          };
          if (cancelled) return;
          setCards((current) => {
            const next = { ...current };
            for (const result of body.results) {
              next[result.id] = result.ok && result.now
                ? { status: "ready", now: result.now }
                : { status: "error", error: result.error };
            }
            return next;
          });
        } catch (error) {
          if (controller.signal.aborted || cancelled) return;
          setCards((current) => {
            const next = { ...current };
            for (const id of chunk) {
              if (next[id]?.status === "ready") continue;
              next[id] = {
                status: "error",
                error: error instanceof Error ? error.message : "Couldn't load conditions.",
              };
            }
            return next;
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SPOTS.filter((spot) => {
      if (coast !== "All" && spot.coast !== coast) return false;
      if (!needle) return true;
      return [spot.name, spot.place, spot.coast, spot.country, spot.breakType]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [coast, query]);

  const readyCount = filtered.filter((spot) => cards[spot.id]?.status === "ready").length;
  const errorCount = filtered.filter((spot) => cards[spot.id]?.status === "error").length;
  const starred = filtered.filter((spot) => favorites.ids.includes(spot.id));

  return (
    <div>
      <p className="text-xs font-medium tracking-[0.18em] text-sea uppercase">Open surf report</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl tracking-tight sm:text-6xl">
        The whole forecast, in plain language.
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
        {SPOTS.length} breaks. This view starts on the Santa Barbara Channel, around Isla Vista, where west swell has to wrap the islands. California, Hawaii, the East Coast, and a few coasts abroad are one tap away.
      </p>

      <div className="mt-6 grid gap-3">
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="spot-search">
          Search breaks
          <Input
            id="spot-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try Campus Point, Sands, or Rincon"
            className="h-11 bg-card text-base"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Coast">
          {(["All", ...COASTS] as const).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={coast === item ? "default" : "outline"}
              className={coast === item ? "min-h-10 shrink-0" : "min-h-10 shrink-0 bg-card"}
              aria-pressed={coast === item}
              onClick={() => setCoast(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {readyCount} of {filtered.length} breaks in this view have live conditions
          {errorCount ? ` · ${errorCount} didn't load` : ""}. Stars stay on this phone.
        </p>
        {errorCount > 0 ? (
          <Button type="button" variant="outline" className="w-fit min-h-10 bg-card" onClick={() => setAttempt((value) => value + 1)}>
            Retry the ones that failed
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-card p-6 text-muted-foreground ring-1 ring-foreground/10">
          No breaks match that. Try a town, a coast, or a spot name.
        </p>
      ) : null}

      {starred.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl tracking-tight">Starred</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {starred.map((spot) => (
              <SpotCard key={`star-${spot.id}`} spot={spot} status={cards[spot.id]?.status ?? "loading"} now={cards[spot.id]?.now} />
            ))}
          </div>
        </section>
      ) : null}

      {COASTS.map((item) => {
        const spots = filtered.filter((spot) => spot.coast === item);
        if (!spots.length) return null;
        return (
          <section key={item} className="mt-8">
            <h2 className="font-display text-2xl tracking-tight">{item}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {spots.map((spot) => (
                <SpotCard key={spot.id} spot={spot} status={cards[spot.id]?.status ?? "loading"} now={cards[spot.id]?.now} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
