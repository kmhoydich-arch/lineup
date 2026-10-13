"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20" role="alert">
      <h1 className="font-display text-4xl tracking-tight">Something broke on this page.</h1>
      <p className="mt-3 text-muted-foreground">The report could not render. The forecast services may be briefly down.</p>
      <Button type="button" className="mt-6 min-h-11" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
