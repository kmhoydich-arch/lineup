import { Skeleton } from "@/components/ui/skeleton";

export function ReportSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-5" aria-hidden="true">
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="space-y-4 lg:col-span-3">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-36 shrink-0 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <p className="sr-only">Loading the forecast.</p>
    </div>
  );
}
