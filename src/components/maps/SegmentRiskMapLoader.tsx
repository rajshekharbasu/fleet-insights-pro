import { lazy, Suspense, useEffect, useState } from "react";
import type { SegmentRiskMapProps } from "./SegmentRiskMap";

const SegmentRiskMapLazy = lazy(() =>
  import("./SegmentRiskMap").then((m) => ({ default: m.SegmentRiskMap })),
);

function MapSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-border/50 bg-muted/20"
      style={{ height }}
    >
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-pulse rounded-full bg-primary/20" />
        <p className="mt-3 text-[12px] text-muted-foreground">Loading risk map…</p>
      </div>
    </div>
  );
}

/** Client-only wrapper — Leaflet does not run during SSR. */
export function SegmentRiskMapLoader(props: SegmentRiskMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <MapSkeleton height={props.height ?? 560} />;

  return (
    <Suspense fallback={<MapSkeleton height={props.height ?? 560} />}>
      <SegmentRiskMapLazy {...props} />
    </Suspense>
  );
}
