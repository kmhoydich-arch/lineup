import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <p className="text-xs font-medium tracking-[0.16em] text-sea uppercase">Missing break</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">That spot is not in the lineup.</h1>
      <p className="mt-3 text-muted-foreground">The address does not match one of the seeded breaks.</p>
      <Button className="mt-6 min-h-11" nativeButton={false} render={<Link href="/" />}>
        Back to all breaks
      </Button>
    </div>
  );
}
