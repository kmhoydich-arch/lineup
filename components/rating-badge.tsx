import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { Rating } from "@/lib/types";

const styles: Record<Rating, string> = {
  poor: "bg-[#f3d6d0] text-[#8c2f28]",
  fair: "bg-[#f6e4c2] text-[#8a5a10]",
  good: "bg-[#d7eee4] text-[#0f5c45]",
  epic: "bg-[#241533] text-[#f3e6c4]",
};

export function RatingBadge({
  rating,
  className,
}: {
  rating: Rating;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "h-auto px-2.5 py-1 text-xs font-semibold tracking-[0.14em] uppercase",
        styles[rating],
        className,
      )}
    >
      {rating}
    </Badge>
  );
}
