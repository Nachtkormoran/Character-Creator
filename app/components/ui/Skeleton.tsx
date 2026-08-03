/**
 * Platzhalter für ladende Inhalte (statt Leerzustand/Layout-Sprung). Sanftes
 * Pulsieren; unter `prefers-reduced-motion` schaltet `globals.css` es ab.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
      aria-hidden="true"
    />
  );
}

/** Eine ladende Charakter-„Tafel" – gleiche Silhouette wie die echte Karte. */
export function CharacterCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}
