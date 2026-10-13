"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshForecast } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ForecastErrorView({ spotId, message }: { spotId: string; message: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10" role="alert">
      <h2 className="font-display text-2xl tracking-tight">The forecast did not load</h2>
      <p className="mt-2 max-w-xl text-muted-foreground">{message}</p>
      <Button
        type="button"
        className="mt-4 min-h-11"
        disabled={pending}
        onClick={() => {
          start(async () => {
            await refreshForecast(spotId);
            router.refresh();
          });
        }}
      >
        {pending ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}
