import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">
          Model guidance, not a safety report. You decide whether to paddle out. Forecasts refresh about every 20 minutes.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/how-it-works" className="underline-offset-4 hover:underline">
            How scoring works
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <span>No account, no ads</span>
        </div>
      </div>
    </footer>
  );
}
